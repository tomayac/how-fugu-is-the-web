const a = document.querySelector('a');
const pre = document.querySelector('pre');

const code = new URL(location.href).searchParams.get('code');

a.href = code;
a.textContent = code;

const SURROUNDING_CHARS = 100000;

const escapeHTML = (str) => {
  const div = document.createElement('div');
  div.append(document.createTextNode(str));
  return div.innerHTML;
};

(async () => {
  let text = await fetch(code).then((response) => response.text());
  text = escapeHTML(text);
  const textStart = document.fragmentDirective.items[0].textStart;

  text = text.replaceAll(textStart, `<mark>${textStart}</mark>`);
  const index = text.indexOf(`<mark>${textStart}</mark>`);
  pre.innerHTML = `${text.substring(
    index - SURROUNDING_CHARS > 0 ? index - SURROUNDING_CHARS : 0,
    index,
  )}${text.substring(
    index,
    index + SURROUNDING_CHARS > text.length
      ? text.length
      : index + SURROUNDING_CHARS,
  )}`;
  pre.querySelector('mark').scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: no-preference').matches
      ? 'smooth'
      : 'auto',
    block: 'center',
  });
})();
