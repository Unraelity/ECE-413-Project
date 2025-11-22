// Shows Dashboard link only when logged in; puts Log In/Log Out on the right
(function () {
  function mountNav() {
    var token = localStorage.getItem('token');
    var authArea = document.getElementById('authArea');
    var dashLink = document.getElementById('navDashboard');

    if (dashLink) {
        if (token) {
            dashLink.style.display = '';
        } else {

            dashLink.style.display = 'none';
        }
    }

    if (!authArea) {
        return;
    }
    if (token) {
      authArea.innerHTML = '<button id="btnLogOut" type="button" class="btn btn-nav">Log Out</button>';
      var btn = document.getElementById('btnLogOut');
      if (btn) {
        btn.addEventListener('click', function () {
          localStorage.removeItem('token');
          location.href = '/login.html';
        });
      }
    } else {
      authArea.innerHTML = '<a class="text-az-white" href="/login.html">Log In/Sign Up</a>';
    }
  }
  document.addEventListener('DOMContentLoaded', mountNav);
})();