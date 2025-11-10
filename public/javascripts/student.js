// public/javasciprts/student.js

function createStudent() {
    // data validation
    if ($('#name').val() === "") {
        window.alert("invalid name!");
        return;
    }
    if ($('#major').val() === "") {
        window.alert("invalid major!");
        return;
    }
    if ($('#gpa').val() === "") {
        window.alert("invalid gpa!");
        return;
    }
    let txdata = {
        name: $('#name').val(),
        major: $('#major').val(), 
        gpa: Number($('#gpa').val())
    };
    $.ajax({
        url: '/students/create',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(txdata),
        dataType: 'json'
    })
    .done(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    })
    .fail(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    });
}

function readStudent() {
    // data validation
    if ($('#name').val() === "") {
        window.alert("invalid name!");
        return;
    }
    let txdata = {
        name: $('#name').val()
    };
    $.ajax({
        url: '/students/read',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(txdata),
        dataType: 'json'
    })
    .done(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
        $('#rxData').html(JSON.stringify(jqXHR, null, 2));
    });
}

function updateStudent() {
    // data validation
    if ($('#name').val() === "") {
        window.alert("invalid name!");
        return;
    }
    if ($('#major').val() === "") {
        window.alert("invalid major!");
        return;
    }
    if ($('#gpa').val() === "") {
        window.alert("invalid gpa!");
        return;
    }
    let txdata = {
        name: $('#name').val(),
        major: $('#major').val(), 
        gpa: $('#gpa').val()
    };
    $.ajax({
        url: '/students/update',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(txdata),
        dataType: 'json'
    })
    .done(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    })
    .fail(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    });
}

function deleteStudent() {
    // data validation
    if ($('#name').val() === "") {
        window.alert("invalid name!");
        return;
    }
    let txdata = {
        name: $('#name').val()
    };
    $.ajax({
        url: '/students/delete',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(txdata),
        dataType: 'json'
    })
    .done(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
        $('#rxData').html(JSON.stringify(jqXHR, null, 2));
    });
}

function getCount() {
    $.ajax({
        url: '/students/count',
        method: 'GET'
    })
    .done(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    })
    .fail(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    });
}

function readAll() {
    /* your code here */
    $.ajax({
        url: '/students/readAll',
        method: 'GET'
    })
    .done(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    })
    .fail(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    });
}

function searchStudent() {
    // data validation
    if ($('#gpa').val() === "") {
        window.alert("invalid gpa!");
        return;
    }
    let txdata = {
        gpa: Number($('#gpa').val())
    };
    $.ajax({
        url: '/students/search',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(txdata),
        dataType: 'json'
    })
    .done(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    })
    .fail(function (data, textStatus, jqXHR) {
        $('#rxData').html(JSON.stringify(data, null, 2));
    });
}

$(function () {
    $('#btnCreate').click(createStudent);
    $('#btnRead').click(readStudent);
    $('#btnUpdate').click(updateStudent);
    $('#btnDelete').click(deleteStudent);
    $('#btnCount').click(getCount);
    $('#btnReadAll').click(readAll);
    $('#btnSearch').click(searchStudent);
});