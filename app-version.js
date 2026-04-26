/* Shared app version for cache-busting across all entry pages. */
(function(w){
  var version = '2026.04.26.1';
  w.APP_VERSION = version;
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
})(window);
