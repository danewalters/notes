// Behaviour ported from the serene theme (https://github.com/isunjn/serene), MIT License.

const { copyIcon, checkIcon } = document.querySelector('#copy-cfg').dataset;

function enableThemeToggle() {
  const themeToggle = document.querySelector('#theme-toggle');
  if (!themeToggle) return;
  const preferDark = window.matchMedia('(prefers-color-scheme: dark)');
  const setTheme = (theme) => {
    document.body.classList.toggle('dark', theme == 'dark');
    sessionStorage.setItem('theme', theme);
  };
  const current = () => sessionStorage.getItem('theme') || (preferDark.matches ? 'dark' : 'light');
  themeToggle.addEventListener('click', () => setTheme(current() == 'dark' ? 'light' : 'dark'));
  preferDark.addEventListener('change', (e) => setTheme(e.matches ? 'dark' : 'light'));
}

function enableRssMask() {
  const rssBtn = document.querySelector('#rss-btn');
  const mask = document.querySelector('#rss-mask');
  if (!rssBtn || !mask) return;
  const copyBtn = mask.querySelector('button');
  rssBtn.addEventListener('click', (e) => {
    e.preventDefault();
    mask.showModal();
  });
  mask.addEventListener('click', (e) => {
    if (e.target == mask) mask.close();
  });
  const copy = () => {
    navigator.clipboard.writeText(copyBtn.dataset.link).then(() => {
      copyBtn.innerHTML = checkIcon;
      copyBtn.classList.add('copied');
      copyBtn.removeEventListener('click', copy);
      setTimeout(() => {
        mask.close();
        copyBtn.innerHTML = copyIcon;
        copyBtn.classList.remove('copied');
        copyBtn.addEventListener('click', copy);
      }, 400);
    });
  };
  copyBtn.addEventListener('click', copy);
}

function enableBackLink() {
  const backLink = document.querySelector('#back-link');
  if (!backLink) return;
  backLink.addEventListener('click', (e) => {
    if (document.referrer && location.href.startsWith(document.referrer) && !location.hash && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

function enableTocTooltip() {
  const anchors = document.querySelectorAll('aside nav a');
  if (anchors.length == 0) return;
  const toggleTooltip = () => {
    anchors.forEach((anchor) => {
      if (anchor.offsetWidth < anchor.scrollWidth) anchor.setAttribute('title', anchor.textContent);
      else anchor.removeAttribute('title');
    });
  };
  window.addEventListener('resize', toggleTooltip);
  toggleTooltip();
}

function addBackToTopBtn() {
  const backBtn = document.querySelector('#back-to-top');
  if (!backBtn) return;
  backBtn.addEventListener('click', () => window.scrollTo({ top: 0 }));
  const toggle = () => {
    const shown = document.documentElement.scrollTop > 200;
    backBtn.classList.toggle('shown', shown);
    backBtn.setAttribute('tabindex', shown ? 0 : -1);
  };
  window.addEventListener('scroll', toggle);
  toggle();
}

function addCopyBtns() {
  document.querySelectorAll('.prose pre:not(.mermaid)').forEach((block) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'codeblock';
    const btn = document.createElement('button');
    btn.className = 'copy';
    btn.ariaLabel = 'copy';
    btn.innerHTML = copyIcon;
    const copy = () => {
      navigator.clipboard.writeText(block.textContent).then(() => {
        btn.innerHTML = checkIcon;
        btn.classList.add('copied');
        btn.removeEventListener('click', copy);
        setTimeout(() => {
          btn.innerHTML = copyIcon;
          btn.classList.remove('copied');
          btn.addEventListener('click', copy);
        }, 1500);
      });
    };
    btn.addEventListener('click', copy);
    block.replaceWith(wrapper);
    wrapper.append(block, btn);
  });
}

function addFootnoteBacklink() {
  document.querySelectorAll('.footnote-definition').forEach((footnote) => {
    const backlink = document.createElement('button');
    backlink.className = 'backlink';
    backlink.ariaLabel = 'backlink';
    backlink.innerHTML = '↩︎';
    backlink.addEventListener('click', () => window.scrollTo({
      top: document.querySelector(`.footnote-reference a[href="#${footnote.id}"]`).getBoundingClientRect().top + window.scrollY,
    }));
    (footnote.lastElementChild || footnote).appendChild(backlink);
  });
}

enableThemeToggle();
enableRssMask();
enableBackLink();
if (document.body.classList.contains('post')) {
  addBackToTopBtn();
  enableTocTooltip();
}
if (document.querySelector('.prose')) {
  addCopyBtns();
  addFootnoteBacklink();
}
