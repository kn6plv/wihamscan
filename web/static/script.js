const dummyWS = { send: () => {} };
let ws = dummyWS;

// If the window disconnects from the server, poll until it comes back and reload
function watchAndReload() {
  if (window.location.pathname === '/') {
    const TIMEOUT = 10000;
    function reload() {
      const req = new XMLHttpRequest();
      req.open('GET', window.location.toString());
      req.onreadystatechange = function() {
        if (req.readyState === 4) {
          if (req.status === 200) {
            window.location.reload();
          }
          else {
            setTimeout(reload, TIMEOUT);
          }
        }
      }
      req.timeout = TIMEOUT;
      try {
        req.send(null);
      }
      catch (_) {
      }
    }
    setTimeout(reload, TIMEOUT);
  }
}

const onMessage = {
};

function runMessageManager() {
  let keepalive;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${location.pathname}ws${location.search}`);
  ws.addEventListener('close', () => {
    clearInterval(keepalive);
    ws = dummyWS;
    watchAndReload();
  });
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    const fn = onMessage[msg.cmd];
    if (fn) {
      fn(msg);
    }
  });
  ws.addEventListener('open', () => {
    send("init", { path: location.hash.slice(1).split("@").map(p => decodeURIComponent(p)) });
  });
  setInterval(() => send('keepalive'), 30 * 1000);
}

const psend = {};
function send(cmd, value, delay) {
  clearTimeout(psend[cmd]);
  if (delay !== undefined) {
    psend[cmd] = setTimeout(() => {
      send(cmd, value);
    }, delay * 1000);
  }
  else {
    ws.send(JSON.stringify({
      cmd: cmd,
      value: value
    }));
  }
}

onMessage['html.update'] = msg => {
  const node = document.getElementById(msg.value.id);
  if (node) {
    const active = document.activeElement;
    node.innerHTML = msg.value.html;
    if (active && active.id) {
      const elem = document.getElementById(active.id);
      if (elem && elem != active && (active.nodeName === 'INPUT' || active.nodeName === 'SELECT' || active.nodeName === 'TEXTAREA')) {
        elem.replaceWith(active);
        active.focus();
      }
    }
    const scripts = node.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      try {
        eval(scripts[i].innerText);
      }
      catch (e) {
        console.error(e);
      }
    }
  }
}

onMessage['svg.path.update'] = msg => {
  const svgpath = document.getElementById(msg.value.id);
  if (svgpath) {
    const oanimate = svgpath.querySelector("animate");
    if (oanimate) {
      const last = oanimate.getAttribute("values").split(';');
      svgpath.removeChild(oanimate);
      const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      animate.setAttribute("attributeName", "d");
      animate.setAttribute("dur", "1s");
      animate.setAttribute('fill', 'freeze');
      if (!last[0]) {
        animate.setAttribute("values", msg.value.d);
      }
      else {
        animate.setAttribute("values", `${last[last.length - 1]};${msg.value.d}`);
      }
      svgpath.appendChild(animate);
      animate.beginElement();
    }
    else {
      svgpath.setAttribute("d", msg.value.d);
    }
  }
}

onMessage['waterfall.update'] = msg => {
  const waterfall = document.getElementById(msg.value.id);
  if (waterfall) {
    const builder = document.createElement("div");
    builder.innerHTML = msg.value.l;
    const e = builder.firstElementChild;
    waterfall.style.transition = "";
    waterfall.style.top = `-2px`;
    waterfall.insertBefore(e, waterfall.firstElementChild);
    setTimeout(() => {
      waterfall.style.transition = "top 1s linear";
      waterfall.style.top = "0px";
    }, 10);
    if (waterfall.childElementCount > 100) {
      waterfall.removeChild(waterfall.lastElementChild);
    }
  }
}

currentLocation = {};

function updateHash() {
  let nhash = "#";
  if (currentLocation.name) {
    nhash += currentLocation.name;
  }
  for (const k in currentLocation.arg) {
    nhash += `#${btoa(JSON.stringify(currentLocation.arg))}`;
    break;
  }
  if (location.hash !== nhash) {
    location.hash = nhash;
  }
}

onMessage['page.change'] = msg => {
  currentLocation = Object.assign({ name: '', arg: {} }, msg.value);
  updateHash();
}

window.addEventListener('pageshow', runMessageManager);
window.addEventListener('hashchange', () => {
  send("select", { path: location.hash.slice(1).split("@").map(p => decodeURIComponent(p)) });
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    send('visible', true);
  }
  else {
    send('visible', false);
  }
});

const visibleQ = [];
window.whenVisible = (id, tick, callback) => {
  (new MutationObserver(() => {
    clearTimeout(entry.timer);
  })).observe(document.getElementById(id), { childList: true });
  const now = Date.now();
  const entry = {
    tick: tick * 1000,
    callback: callback,
    timer: null,
    last: now,
    exec: () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const delay = now - entry.last;
        entry.last = now;
        entry.timer = setTimeout(entry.exec, entry.tick - (entry.last % entry.tick));
        try {
          entry.callback(delay);
        }
        catch (e) {
          console.error(e);
        }
      }
      else {
        entry.timer = 'pending';
      }
    }
  };
  visibleQ.push(entry);
  entry.timer = setTimeout(entry.exec, entry.tick - (entry.last % entry.tick));
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    visibleQ.forEach(entry => {
      if (entry.timer === 'pending') {
        entry.exec();
      }
    });
  }
});
