/* AXIOM PULSE: approved calendar-style Create Delivery pickers */
(function () {
  const pad = n => String(n).padStart(2, '0');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const short = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const pretty = s => { const [y,m,d] = s.split('-').map(Number); return `${short[m-1]} ${d}, ${y}`; };
  const parseTime = t => { let [h,m] = String(t || '12:00').split(':').map(Number); return { h, m, ap: h >= 12 ? 'PM' : 'AM', dh: h % 12 || 12 }; };
  const timeLabel = t => { const p = parseTime(t); return `${pad(p.dh)}:${pad(p.m)} ${p.ap}`; };

  window.openCreateDatePicker = function () {
    const pop = document.getElementById('createDatePop'), hidden = document.getElementById('dd'), display = document.getElementById('ddDisplay');
    if (!pop || !hidden || !display) return;
    if (pop.style.display === 'block') { pop.style.display = 'none'; return; }
    let base = hidden.value ? new Date(hidden.value + 'T12:00:00') : new Date();
    let view = new Date(base.getFullYear(), base.getMonth(), 1);
    const render = () => {
      const first = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
      const last = new Date(view.getFullYear(), view.getMonth()+1, 0).getDate();
      const prev = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
      const years = Array.from({length: 17}, (_, i) => view.getFullYear() - 5 + i);
      let h = '<div style="display:flex;gap:8px;margin-bottom:10px">';
      h += '<select id="cdm" style="flex:1;background:#081624;color:#fff;border:1px solid #315473;border-radius:8px;padding:9px">' + months.map((m,i)=>`<option value="${i}" ${i===view.getMonth()?'selected':''}>${m}</option>`).join('') + '</select>';
      h += '<select id="cdy" style="flex:1;background:#081624;color:#fff;border:1px solid #315473;border-radius:8px;padding:9px">' + years.map(y=>`<option value="${y}" ${y===view.getFullYear()?'selected':''}>${y}</option>`).join('') + '</select></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:12px;color:#6b7280;margin-bottom:4px">' + ['Su','Mo','Tu','We','Th','Fr','Sa'].map(x=>`<div>${x}</div>`).join('') + '</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center">';
      for (let i=0;i<42;i++) {
        let day=i-first+1, mo=view.getMonth(), yr=view.getFullYear(), muted=false;
        if(day<1){day=prev+day;mo--;muted=true;} else if(day>last){day-=last;mo++;muted=true;}
        const cell=new Date(yr,mo,day), value=iso(cell), selected=value===hidden.value;
        h += `<button type="button" data-create-date="${value}" style="height:34px;border:0;border-radius:7px;background:${selected?'#4f88c7':'transparent'};color:${muted?'#9ca3af':'#1f2937'};font-weight:${selected?'700':'500'}">${day}</button>`;
      }
      h += '</div>';
      pop.innerHTML=h; pop.style.display='block';
      document.getElementById('cdm').onchange=e=>{view.setMonth(+e.target.value);render();};
      document.getElementById('cdy').onchange=e=>{view.setFullYear(+e.target.value);render();};
      pop.querySelectorAll('[data-create-date]').forEach(btn=>btn.onclick=()=>{hidden.value=btn.dataset.createDate;display.value=pretty(hidden.value);pop.style.display='none';});
    };
    render();
  };

  window.openCreateTimePicker = function () {
    const pop=document.getElementById('createTimePop'), hidden=document.getElementById('dt'), display=document.getElementById('dtDisplay');
    if(!pop||!hidden||!display)return;
    if(pop.style.display==='block'){pop.style.display='none';return;}
    const p=parseTime(hidden.value||'12:00');
    pop.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'+
      '<select id="cth" style="background:#081624;color:#fff;border:1px solid #426886;border-radius:8px;padding:10px">'+Array.from({length:12},(_,i)=>i+1).map(h=>`<option value="${h}" ${h===p.dh?'selected':''}>${pad(h)}</option>`).join('')+'</select>'+ 
      '<select id="ctm" style="background:#081624;color:#fff;border:1px solid #426886;border-radius:8px;padding:10px">'+Array.from({length:60},(_,i)=>`<option value="${pad(i)}" ${i===p.m?'selected':''}>${pad(i)}</option>`).join('')+'</select>'+ 
      '<select id="cta" style="background:#081624;color:#fff;border:1px solid #426886;border-radius:8px;padding:10px"><option '+(p.ap==='AM'?'selected':'')+'>AM</option><option '+(p.ap==='PM'?'selected':'')+'>PM</option></select></div>'+ 
      '<button type="button" class="btn" style="margin-top:10px" onclick="setCreateTimePicker()">SET TIME</button>';
    pop.style.display='block';
  };

  window.setCreateTimePicker = function () {
    const h=+document.getElementById('cth').value, m=document.getElementById('ctm').value, ap=document.getElementById('cta').value;
    const h24=h%12+(ap==='PM'?12:0), t=pad(h24)+':'+m;
    document.getElementById('dt').value=t;
    document.getElementById('dtDisplay').value=timeLabel(t);
    document.getElementById('createTimePop').style.display='none';
  };

  function decorateCreateForm(){
    const dd=document.getElementById('dd'),dt=document.getElementById('dt'),ddDisplay=document.getElementById('ddDisplay'),dtDisplay=document.getElementById('dtDisplay');
    if(!dd||!dt||!ddDisplay||!dtDisplay)return;
    dd.type='hidden';dt.type='hidden';
    ddDisplay.readOnly=true;ddDisplay.type='text';ddDisplay.placeholder='Select date';ddDisplay.style.cursor='pointer';ddDisplay.onclick=window.openCreateDatePicker;
    dtDisplay.readOnly=true;dtDisplay.type='text';dtDisplay.placeholder='Select time';dtDisplay.style.cursor='pointer';dtDisplay.onclick=window.openCreateTimePicker;
  }
  const originalNewDelivery=window.newDelivery;
  if(typeof originalNewDelivery==='function'){
    window.newDelivery=function(){originalNewDelivery();setTimeout(decorateCreateForm,0);};
  }
})();
