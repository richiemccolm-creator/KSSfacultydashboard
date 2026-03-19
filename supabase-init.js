/**
 * Initializes Supabase client. Include after config.js and supabase-js.
 * Usage: <script src="config.js"></script>
 *        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *        <script src="supabase-init.js"></script>
 */
(function() {
  if (typeof window.supabase !== 'undefined') return;
  var url = window.SUPABASE_URL;
  var key = window.SUPABASE_ANON_KEY;
  if (!url || !key || url.indexOf('your-project') !== -1) {
    console.warn('Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js');
    window.supabase = null;
    return;
  }
  try {
    var sb = typeof supabase !== 'undefined' ? supabase : window.supabase;
    var createClient = sb.createClient;
    window.supabase = createClient(url, key);
  } catch (e) {
    console.error('Supabase init failed:', e);
    window.supabase = null;
  }
})();
