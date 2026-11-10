
const AUTH_API = 'http://127.0.0.1:8000';

function saveTokens(data) {
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
}

function getAccessToken() {
  return localStorage.getItem('access_token');
}

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function login(username, password) {
  const response = await fetch(`${AUTH_API}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error('Неправильний логін або пароль.');
  }

  saveTokens(data);
  return data;
}

async function register(username, email, password, passwordConfirmation) {
  const response = await fetch(`${AUTH_API}/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username,
      email,
      password,
      password_confirmation: passwordConfirmation
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh_token');

  if (!refresh) {
    logout();
    return null;
  }

  try {
    const response = await fetch(`${AUTH_API}/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh })
    });

    if (!response.ok) {
      logout();
      return null;
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access);
    return data.access;
  } catch {
    return null;
  }
}

async function authenticatedFetch(path, options = {}) {
  let token = getAccessToken();

  if (!token) {
    token = await refreshAccessToken();
  }

  if (!token) {
    throw new Error('Потрібно увійти в систему.');
  }

  const makeRequest = accessToken => fetch(`${AUTH_API}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });

  let response = await makeRequest(token);

  if (response.status === 401) {
    token = await refreshAccessToken();

    if (!token) {
      throw new Error('Сесія завершилася. Увійдіть знову.');
    }

    response = await makeRequest(token);
  }

  return response;
}
