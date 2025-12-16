// public/javasciprts/signup.js

// Called when the user clicks the "Sign Up" button
function signup() {

  // --- Basic client-side validation ---
  // (This only checks for empty strings. The server must still validate everything.)
  if ($('#email').val() === "") {
    window.alert("invalid email!");
    return; // stop signup() early
  }

  if ($('#password').val() === "") {
    window.alert("invalid password");
    return; // stop signup() early
  }

  // Build JSON payload from form inputs
  let txdata = {
    email: $('#email').val(),       // value from <input id="email">
    password: $('#password').val()  // value from <input id="password">
  };

  // Send POST request to backend signup route
  $.ajax({
    url: '/customers/signUp',          // server endpoint that creates a new user
    method: 'POST',                   // HTTP method
    contentType: 'application/json',  // tell server we are sending JSON
    data: JSON.stringify(txdata),     // convert JS object -> JSON string
    dataType: 'json'                  // expect JSON response back
  })
    // If signup succeeds (request returned 2xx)
    .done(function (data, textStatus, jqXHR) {
      // Display server response in a readable form (useful for debugging)
      $('#rxData').html(JSON.stringify(data, null, 2));

      // If server indicates the signup was successful...
      if (data.success) {
        // Wait 1 second so user can see the message, then redirect to login page
        setTimeout(function () {
          window.location = "login.html";
        }, 1000);
      }
    })
    // If signup fails (request returned 4xx/5xx, network error, etc.)
    .fail(function (jqXHR, textStatus, errorThrown) {

      // Special-case: if server is unreachable or route isn't found, show a friendlier message
      // (Note: 404 can mean "route not found" too, not only "server unreachable")
      if (jqXHR.status == 404) {
        $('#rxData').html("Server could not be reached!!!");
      } else {
        // Otherwise show the full jQuery XHR object for debugging
        $('#rxData').html(JSON.stringify(jqXHR, null, 2));
      }
    });
}

// jQuery "document ready": attach click handler once DOM is loaded
$(function () {
  $('#btnSignUp').click(signup);
});