// Shows Dashboard link only when logged in; puts Log In/Log Out on the right
(function () {

  // Builds/updates the navigation UI based on whether a JWT token exists in localStorage
  function mountNav() {
    // Read the auth token (your app stores JWT here after login)
    var token = localStorage.getItem('token');

    // Container where we will inject either "Log In/Sign Up" or a "Log Out" button
    var authArea = document.getElementById('authArea');

    // The Dashboard link element in your navbar (e.g., <a id="navDashboard" ...>)
    var dashLink = document.getElementById('navDashboard');

    // --- 1) Show/hide the Dashboard link based on login state ---
    if (dashLink) {
      if (token) {
        // Logged in: show Dashboard link
        dashLink.style.display = '';
      } else {
        // Not logged in: hide Dashboard link entirely
        dashLink.style.display = 'none';
      }
    }

    // If there's no authArea element on this page, we can't mount login/logout UI
    // (But we already handled dashLink above, so we just return here.)
    if (!authArea) {
      return;
    }

    // --- 2) Put Log In/Log Out controls on the right (inside authArea) ---
    if (token) {
      // Logged in: replace authArea contents with a Log Out button
      authArea.innerHTML =
        '<button id="btnLogOut" type="button" class="btn btn-nav">Log Out</button>';

      // Attach click handler to newly-inserted button
      var btn = document.getElementById('btnLogOut');
      if (btn) {
        btn.addEventListener('click', function () {
          // Remove token so future requests are unauthenticated
          localStorage.removeItem('token');

          // Redirect to login page (could also redirect to index/home if you prefer)
          location.href = '/login.html';
        });
      }
    } else {
      // Not logged in: show a link to login/sign up instead
      authArea.innerHTML =
        '<a class="text-az-white" href="/login.html">Log In/Sign Up</a>';
    }
  }

  // Run mountNav once the HTML is fully parsed and elements exist in the DOM
  document.addEventListener('DOMContentLoaded', mountNav);

  // Invoke the IIFE immediately so the event listener is registered right away
})();
