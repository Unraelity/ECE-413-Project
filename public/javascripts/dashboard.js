$(function () {
  const token = localStorage.getItem("token");
  if (!token) return location.replace("display.html");

  $('#btnLogOut').click(() => { 
    localStorage.removeItem("token");
    location = "login.html"; 
  });

  // weekly summary
  $.ajax({ url: '/readings/weekly-summary', method: 'GET',
           headers: { 'x-auth': token }, dataType: 'json' })
  .done(renderWeekly).fail(showErr);

  // daily chart for selected day
  $('#dayPick').val(new Date().toISOString().slice(0,10)).change(loadDay);
  loadDay(token);

  function loadDay(){
    $.ajax({ url: '/readings?day=' + $('#dayPick').val(), method: 'GET',
             headers: { 'x-auth': token }, dataType: 'json' })
    .done(renderDay).fail(showErr);
  }

  $('#btnRegisterDevice').click(registerDevice);
  $('#btnRefreshDevices').click(loadDevices);
  loadDevices(token);
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

function renderDevices(list){
  const $wrap = $('#devicesList').empty();
  if (!list || list.length === 0) { $wrap.html('<em>No devices yet. Register one above.</em>'); return; }
  list.forEach(dev => {
    $wrap.append($(`
      <div class="device-row">
        <div class="device-meta">
          <span class="device-name">${dev.name}</span>
          <div class="api-line small">
            <span class="muted">Particle ID:</span>
            <span class="code-badge">${dev.particleId || '—'}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-del" data-id="${dev._id}">Delete</button>
      </div>
    `));
  });
  $('.btn-del').off('click').on('click', function(){
    const id = $(this).data('id');
    const token = localStorage.getItem('token');
    $.ajax({ url:'/devices/'+id, method:'DELETE', headers:{'x-auth':token}})
      .done(loadDevices).fail(()=>alert('Delete failed'));
  });
}

function loadDevices(){
  const token = localStorage.getItem('token');
  $.ajax({ url:'/devices', method:'GET', headers:{'x-auth':token}, dataType:'json'})
    .done(renderDevices).fail(()=>$('#devicesList').html('<em>Error loading devices.</em>'));
}

function registerDevice(){
  const token = localStorage.getItem('token');
  const name = $('#deviceName').val().trim();
  const particleId = $('#particleId').val().trim(); // may be empty at first
  if (!name) return alert('Enter a device name');
  $.ajax({
    url:'/devices', method:'POST', headers:{'x-auth':token},
    contentType:'application/json',
    data: JSON.stringify({ name, particleId })
  }).done(()=>{ $('#deviceName').val(''); $('#particleId').val(''); loadDevices(); })
    .fail(jq=>alert(jq.responseText || 'Registration failed'));
}