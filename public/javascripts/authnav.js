(function () {
  function displayAuthNav() {
    var token = localStorage.getItem('token');
    var slot = document.getElementById('authArea');
    if (!slot) return;

    if (token) {
      slot.innerHTML =
        '<a class="text-az-white" href="/dashboard.html" style="margin-right:16px">Dashboard</a>' +
        '<button id="btnLogOut" type="button" class="btn btn-nav">Log Out</button>';

      var btn = document.getElementById('btnLogOut');
      if (btn) {
        btn.addEventListener('click', function () {
          localStorage.removeItem('token');
          location.href = '/login.html';
        });
      }
    } else {
      slot.innerHTML = '<a class="text-az-white" href="/login.html">Log In/Sign Up</a>';
    }
  }

  document.addEventListener('DOMContentLoaded', displayAuthNav);
})();