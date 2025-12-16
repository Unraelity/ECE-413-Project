// public/javasciprts/login.js

// Called when the user clicks the "Log In" button
function login() {
  // Build the request payload from the input fields
  // NOTE: This sends the raw password to your server over HTTP(S).
  // Make sure you're using HTTPS in production.
  let txdata = {
    email: $('#email').val(),       // value from <input id="email">
    password: $('#password').val()  // value from <input id="password">
  };

  // AJAX POST to your backend login route
  $.ajax({
    url: '/customers/logIn',          // server endpoint that validates credentials
    method: 'POST',                  // HTTP method
    contentType: 'application/json', // tell server we are sending JSON
    data: JSON.stringify(txdata),    // convert JS object -> JSON string
    dataType: 'json'                 // expect JSON response back (e.g., { token: "..." })
  })
    // If login succeeds
    .done(function (data, textStatus, jqXHR) {
      // Store the returned JWT token in localStorage
      // This token will be used for authenticated requests (via x-auth header)
      localStorage.setItem("token", data.token);

      // Redirect user to the dashboard after successful login
      window.location.replace("dashboard.html");
    })
    // If login fails (bad password, unknown email, server error, etc.)
    .fail(function (jqXHR, textStatus, errorThrown) {
      // Show the error response for debugging
      // (In production you may want to show a friendlier message)
      $('#rxData').html(JSON.stringify(jqXHR, null, 2));
    });
}

// jQuery "document ready": set up event listeners once the DOM is loaded
$(function () {
  // Hook up the button click to the login() function
  $('#btnLogIn').click(login);
});