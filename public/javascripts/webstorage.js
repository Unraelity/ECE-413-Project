// public/javasciprts/webstorage.js
function saveSessionStorage() {
    // data validation
    if ($('#name').val() === "") {
        window.alert("invalid name!");
        return;
    }
    if ($('#major').val() === "") {
        window.alert("invalid major!");
        return;
    }
    sessionStorage.setItem("name", $('#name').val());
    sessionStorage.setItem("major", $('#major').val());
    let msgStr = `Saved name (${sessionStorage.getItem("name")}) and major (${sessionStorage.getItem("major")}) in the session storage!`;
    $('#rxData').html(msgStr); 
}

function readSessionStorage() {
    if ('name' in sessionStorage) {
        $('#rxData').html(JSON.stringify(sessionStorage, null, 2)); 
    }
    else {
        $('#rxData').html("No saved name and major in the session storage!!!");     
    }
}

function saveLocalStorage() {
    // data validation
    if ($('#name').val() === "") {
        window.alert("invalid name!");
        return;
    }
    if ($('#major').val() === "") {
        window.alert("invalid major!");
        return;
    }
    localStorage.setItem("name", $('#name').val());
    localStorage.setItem("major", $('#major').val());
    let msgStr = `Saved name (${localStorage.getItem("name")}) and major (${localStorage.getItem("major")}) in the local storage!`;
    $('#rxData').html(msgStr); 
}

function readLocalStorage() {
    if ('name' in localStorage) {
        $('#rxData').html(JSON.stringify(localStorage, null, 2)); 
    }
    else {
        $('#rxData').html("No saved name and major in the local storage!!!");     
    }
}

$(function () {
    $('#btnSaveSessionStorage').click(saveSessionStorage);
    $('#btnReadSessionStorage').click(readSessionStorage);
    $('#btnSaveLocalStorage').click(saveLocalStorage);
    $('#btnReadLocalStorage').click(readLocalStorage);
});