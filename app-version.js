/* Shared app version for cache-busting across all entry pages. */
(function(w){
  var STORAGE_KEY = 'fh_deploy_version';
  var FALLBACK_VERSION = 'fallback-2026.05';
  var version = readStoredVersion() || FALLBACK_VERSION;

  w.APP_VERSION = version;

  function normalizeVersion(raw){
    if(!raw) return '';
    var cleaned = String(raw)
      .replace(/^W\//i, '')
      .replace(/"/g, '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    return cleaned || '';
  }

  function readStoredVersion(){
    try{
      return normalizeVersion(w.localStorage.getItem(STORAGE_KEY));
    }catch(e){
      return '';
    }
  }

  function persistVersion(v){
    try{
      w.localStorage.setItem(STORAGE_KEY, v);
    }catch(e){}
  }

  function setVersion(next){
    var normalized = normalizeVersion(next);
    if(!normalized || normalized === version) return false;
    version = normalized;
    w.APP_VERSION = version;
    persistVersion(version);
    return true;
  }

  function responseVersionToken(res){
    if(!res || !res.headers) return '';
    return normalizeVersion(res.headers.get('etag')) ||
      normalizeVersion(res.headers.get('last-modified')) ||
      '';
  }

  function probeDeployVersion(){
    if(!w.fetch) return;
    w.fetch('/faculty-hub.html', {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(function(res){
      if(!res || !res.ok) return;
      if(setVersion(responseVersionToken(res))){
        w.ensureAppVersionInUrl();
      }
    }).catch(function(){});
  }

  w.withAppVersion = function(url){
    try{
      var u = new URL(url, w.location.href);
      u.searchParams.set('v', version);
      return u.toString();
    }catch(e){
      return url;
    }
  };

  w.ensureAppVersionInUrl = function(){
    try{
      var u = new URL(w.location.href);
      if(u.searchParams.get('v') === version) return false;
      u.searchParams.set('v', version);
      w.location.replace(u.toString());
      return true;
    }catch(e){}
    return false;
  };

  probeDeployVersion();
})(window);
