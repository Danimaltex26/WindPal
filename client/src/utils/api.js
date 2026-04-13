import { supabase } from './supabase';

var API_ROOT = import.meta.env.VITE_API_URL || '';
var BASE = API_ROOT + '/api';

async function getToken() {
  var result = await supabase.auth.getSession();
  return (result.data && result.data.session && result.data.session.access_token) || null;
}

async function request(path, options) {
  if (!options) options = {};
  var token = await getToken();
  var headers = Object.assign({}, options.headers);
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  var res = await fetch(BASE + path, Object.assign({}, options, { headers: headers }));
  if (!res.ok) {
    var message = 'Request failed (' + res.status + ')';
    try {
      var body = await res.json();
      message = body.error || body.message || message;
    } catch (e) {}
    throw new Error(message);
  }
  return res.json();
}

export function apiGet(path) {
  return request(path);
}

export function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export function apiPatch(path, body) {
  return request(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function apiDelete(path) {
  return request(path, { method: 'DELETE' });
}

export function apiUpload(path, formData) {
  return request(path, {
    method: 'POST',
    body: formData,
  });
}
