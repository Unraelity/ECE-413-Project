$(function () {
  $('#btnLogOut').click(() => { localStorage.removeItem("token"); location = "login.html"; });
  const token = localStorage.getItem("token");
  if (!token) return location.replace("display.html");

  // weekly summary
  $.ajax({ url: '/readings/weekly-summary', method: 'GET',
           headers: { 'x-auth': token }, dataType: 'json' })
  .done(renderWeekly).fail(showErr);

  // daily chart for selected day
  $('#dayPick').val(new Date().toISOString().slice(0,10)).change(loadDay);
  loadDay();

  function loadDay(){
    $.ajax({ url: '/readings?day=' + $('#dayPick').val(), method: 'GET',
             headers: { 'x-auth': token }, dataType: 'json' })
    .done(renderDay).fail(showErr);
  }
});

function showErr(e){ console.log(e); alert("Request failed"); }

function renderWeekly(rows){
  const labels = rows.map(r=>r.date);
  const avg = rows.map(r=>Math.round(r.avg));
  const min = rows.map(r=>r.min);
  const max = rows.map(r=>r.max);
  new Chart(document.getElementById('weeklyChart'), {
    data: {
      labels,
      datasets: [
        { type:'line', label:'Avg HR', data:avg },
        { type:'bar',  label:'Min HR', data:min },
        { type:'bar',  label:'Max HR', data:max }
      ]
    }, options: { responsive:true, maintainAspectRatio:false }
  });
}

function renderDay(docs){
  const labels = docs.map(x=> new Date(x.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  const hr = docs.map(x=>x.hr);
  const spo2 = docs.map(x=>x.spo2);
  new Chart(document.getElementById('dayChart'), {
    data: {
      labels,
      datasets: [
        { type:'line', label:'HR', data:hr },
        { type:'line', label:'SpO₂', data:spo2 }
      ]
    }, options: { responsive:true, maintainAspectRatio:false }
  });
}