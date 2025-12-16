// public/javasciprts/account.js
// Runs once the DOM is ready (jQuery shorthand for document ready)
$(function () {

  // When the Log Out button is clicked, run the logout() function
  $('#btnLogOut').click(logout);

  // Make an authenticated request to check the current customer's login/status
  $.ajax({
    url: '/customers/status', // Backend route that should return info about the logged-in user
    method: 'GET',            // HTTP method
    // Send the JWT stored in localStorage using the custom header expected by your auth middleware
    headers: { 'x-auth': window.localStorage.getItem("token") },
    dataType: 'json'          // Expect JSON back from the server
  })
    // If the request succeeds (valid token + server returns JSON)
    .done(function (data, textStatus, jqXHR) {
      // Display the returned JSON in a readable, pretty-printed format
      // null, 2 => indentation of 2 spaces
      $('#rxData').html(JSON.stringify(data, null, 2));
    })
    // If the request fails (no token, invalid token, server error, etc.)
    .fail(function (jqXHR, textStatus, errorThrown) {
      // Redirect the user somewhere else (likely a login / display page)
      // because they are not authorized or something went wrong
      window.location.replace("display.html");
    });
});

// Clears the stored token and redirects back to the homepage/login page
function logout() {
  localStorage.removeItem("token");      // Remove JWT so future requests are unauthenticated
  window.location.replace("index.html"); // Send user back to the landing/login page
}
