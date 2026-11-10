
const API = 'http://127.0.0.1:8000';

const STATUS_LABELS = {
  upcoming: 'Заплановано',
  live: 'Триває',
  finished: 'Завершено'
};

async function getJson(path) {
  const response = await fetch(`${API}${path}`);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Сервер повернув некоректну відповідь.');
  }

  if (!response.ok) {
    throw new Error(data.error || `Помилка запиту: ${response.status}`);
  }

  return data;
}

function createElement(tag, className, text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function createMatchCard(match, teamNames, tournamentNames, gameNames) {
  const card = createElement('article', 'match-card');

  const teams = createElement('div', 'teams');

  const team1 = createElement(
    'span',
    'team',
    teamNames[match.team1_id] || `Команда ${match.team1_id}`
  );

  const vs = createElement('span', 'vs', 'VS');

  const team2 = createElement(
    'span',
    'team',
    teamNames[match.team2_id] || `Команда ${match.team2_id}`
  );

  teams.append(team1, vs, team2);

  const info = createElement('div', 'match-info');

  const tournament = createElement(
    'div',
    'info',
    `🏆 ${tournamentNames[match.tournament_id] || `Турнір ${match.tournament_id}`}`
  );

  const gameName = gameNames[match.tournament_game_id] || 'Кіберспорт';
  const game = createElement('div', 'info', `🎮 ${gameName}`);

  const date = new Date(match.start_time);

  const dateText = Number.isNaN(date.getTime())
    ? match.start_time
    : date.toLocaleString('uk-UA', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

  const time = createElement('div', 'info', `🕒 ${dateText}`);

  info.append(tournament, game, time);

  const statusLabel = STATUS_LABELS[match.status] || match.status;

  const status = createElement(
    'span',
    `match-status ${match.status}`,
    statusLabel
  );

  card.append(teams, info, status);
  return card;
}

async function loadMatches(date = '') {
  const list = document.getElementById('matches');
  const errorBox = document.getElementById('error');

  list.replaceChildren();
  errorBox.textContent = '';

  try {
    const [teams, tournaments, games] = await Promise.all([
      getJson('/teams/'),
      getJson('/tournaments/'),
      getJson('/games/')
    ]);

    const teamNames = Object.fromEntries(
      teams.map(team => [team.id, team.name])
    );

    const tournamentNames = Object.fromEntries(
      tournaments.map(tournament => [tournament.id, tournament.name])
    );

    const gameNames = Object.fromEntries(
      games.map(game => [game.id, game.name])
    );

    let path = '/matches/?sort=date_asc';

    if (date) {
      path += `&date=${encodeURIComponent(date)}`;
    }

    const matches = await getJson(path);

    if (matches.length === 0) {
      errorBox.textContent = 'Матчів на цю дату не знайдено.';
      return;
    }

    matches.forEach(match => {
      const tournament = tournaments.find(
        item => item.id === match.tournament_id
      );

      const matchWithGame = {
        ...match,
        tournament_game_id: tournament ? tournament.game_id : null
      };

      list.appendChild(
        createMatchCard(
          matchWithGame,
          teamNames,
          tournamentNames,
          gameNames
        )
      );
    });
  } catch (error) {
    errorBox.textContent =
      'Не вдалося завантажити матчі. Перевір, чи запущений Django API. ' +
      error.message;
  }
}

document.getElementById('date').addEventListener('change', event => {
  loadMatches(event.target.value);
});

document.getElementById('reset').addEventListener('click', () => {
  document.getElementById('date').value = '';
  loadMatches();
});

loadMatches();


// ---------- JWT авторизація ----------

const authSection = document.getElementById('auth-section');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const authButtons = document.getElementById('auth-buttons');
const userPanel = document.getElementById('user-panel');

let authMode = 'login';

function showAuthForm(mode) {
  authMode = mode;
  authForm.reset();
  authMessage.textContent = '';

  const isRegister = mode === 'register';

  document.getElementById('auth-title').textContent =
    isRegister ? 'Реєстрація' : 'Увійти';

  document.getElementById('auth-submit').textContent =
    isRegister ? 'Зареєструватися' : 'Увійти';

  document.getElementById('email-field').hidden = !isRegister;
  document.getElementById('confirm-field').hidden = !isRegister;

  document.getElementById('auth-email').required = isRegister;
  document.getElementById('auth-confirm').required = isRegister;

  document.getElementById('auth-password').autocomplete =
    isRegister ? 'new-password' : 'current-password';

  authSection.hidden = false;
  authSection.scrollIntoView({ behavior: 'smooth' });
}

function hideAuthForm() {
  authSection.hidden = true;
  authForm.reset();
  authMessage.textContent = '';
}

async function updateAuthUI() {
  let token = getAccessToken();

  if (!token) {
    token = await refreshAccessToken();
  }

  if (!token) {
    authButtons.hidden = false;
    userPanel.hidden = true;
    return;
  }

  try {
    const response = await authenticatedFetch('/auth/me/');

    if (!response.ok) {
      throw new Error('Не вдалося отримати профіль.');
    }

    const user = await response.json();

    document.getElementById('username-display').textContent =
      user.username;

    authButtons.hidden = true;
    userPanel.hidden = false;
  } catch {
    authButtons.hidden = false;
    userPanel.hidden = true;
  }
}

document.getElementById('login-btn').addEventListener('click', () => {
  showAuthForm('login');
});

document.getElementById('register-btn').addEventListener('click', () => {
  showAuthForm('register');
});

document.getElementById('auth-cancel').addEventListener('click', () => {
  hideAuthForm();
});

document.getElementById('logout-btn').addEventListener('click', () => {
  logout();
  hideAuthForm();
  updateAuthUI();
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();

  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;

  authMessage.textContent = '';

  try {
    if (authMode === 'register') {
      const email = document.getElementById('auth-email').value.trim();
      const confirmation = document.getElementById('auth-confirm').value;

      await register(username, email, password, confirmation);
      await login(username, password);
    } else {
      await login(username, password);
    }

    hideAuthForm();
    await updateAuthUI();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

updateAuthUI();
