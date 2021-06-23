const pre = document.querySelector('pre');

const code = new URL(location.href).searchParams.get('code');
pre.textContent = code;
