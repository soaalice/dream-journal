// Applies the saved theme before first paint so dark mode never flashes light.
// This is a separate file (not inline in index.html) so the Content-Security-Policy can forbid inline scripts.
try {
  var theme = localStorage.getItem('theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
