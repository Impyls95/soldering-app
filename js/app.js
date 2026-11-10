(function () {
  'use strict';

  /* ---------- Константы и элементы ---------- */
  const PROGRESS_KEY = 'soldering-progress-v1';
  const THEME_KEY = 'soldering-theme';
  const QUIZ_KEY = 'soldering-quiz-best-v1';
  const PLACEHOLDER = 'images/placeholder.svg';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAX_RING = 327;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.prototype.slice.call((root || document).querySelectorAll(selector));

  const sections = $$('[data-lesson]');
  const totalSections = sections.length;
  const sectionIds = new Set(sections.map((section) => section.id));

  const themeToggle = $('#theme-toggle');
  const themeMeta = $('meta[name="theme-color"]');
  const sidebarNav = $('#sidebar-nav');
  const mobileNavList = $('#mobile-nav-list');
  const mobileNav = $('#mobile-nav');
  const navBackdrop = $('#nav-backdrop');
  const menuToggle = $('#menu-toggle');
  const menuClose = $('#menu-close');
  const progressRing = $('#progress-ring');
  const ringFill = $('#ring-fill');
  const heroPct = $('#hero-pct');
  const heroProgressText = $('#hero-progress-text');
  const heroStatus = $('#hero-status');
  const sidebarProgressText = $('#sidebar-progress-text');
  const sidebarProgressPct = $('#sidebar-progress-pct');
  const mobileProgressText = $('#mobile-progress-text');
  const mobileProgressPct = $('#mobile-progress-pct');
  const scrollProgressBar = $('#scroll-progress-bar');
  const toast = $('#toast');
  const toastMessage = $('#toast-message');
  const toastAction = $('#toast-action');
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightbox-img');
  const lightboxCaption = $('#lightbox-caption');
  const lightboxClose = $('#lightbox-close');
  const resetDialog = $('#reset-dialog');
  const resetConfirm = $('#reset-confirm');
  const resetCancel = $('#reset-cancel');
  const installBtn = $('#install-btn');
  const netStatus = $('#net-status');
  const quizForm = $('#quiz-form');
  const quizQuestions = $('#quiz-questions');
  const quizResult = $('#quiz-result');
  const quizScoreEl = $('#quiz-score');
  const quizVerdict = $('#quiz-verdict');
  const quizVerdictBadge = $('#quiz-verdict-badge');
  const quizHint = $('#quiz-hint');
  const quizStatus = $('#quiz-status');
  const quizSubmit = $('#quiz-submit');
  const quizRetry = $('#quiz-retry');
  const quizBestEl = $('#quiz-best');
  const quizSection = $('#quiz');
  const quizData = window.QUIZ;

  const imageMap = new Map((window.IMAGES || []).map((item) => [item.id, item]));

  let completed = new Set();
  let quizBest = -1;
  let currentActive = '';
  let lastFocused = null;
  let backdropTimer = 0;
  let toastTimer = 0;
  let refreshing = false;
  let updateOffered = false;
  let resetQuizState = null;
  let deferredInstallPrompt = null;

  /* ---------- Утилиты ---------- */
  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      /* Хранилище может быть недоступно — интерфейс продолжит работать. */
    }
  }

  function padNumber(number) {
    return String(number).padStart(2, '0');
  }

  function sectionTitle(section) {
    return section.dataset.title || ($('h2', section) && $('h2', section).textContent.trim()) || section.id;
  }

  function makeIcon(pathData, className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    return svg;
  }

  function setText(element, text) {
    if (element) element.textContent = text;
  }

  /* ---------- Тема ---------- */
  function getTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;

    if (themeMeta) {
      themeMeta.setAttribute('content', next === 'dark' ? '#0c1117' : '#f4f1ea');
    }

    if (themeToggle) {
      const label = next === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
      themeToggle.setAttribute('aria-label', label);
      themeToggle.setAttribute('title', label);
    }

    if (persist) writeStorage(THEME_KEY, next);
  }

  function hasSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'dark' || saved === 'light';
    } catch (error) {
      return false;
    }
  }

  function initTheme() {
    applyTheme(getTheme(), false);

    if (themeToggle) {
      themeToggle.addEventListener('click', function () {
        applyTheme(getTheme() === 'dark' ? 'light' : 'dark', true);
      });
    }

    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (media) {
      const onChange = function (event) {
        if (!hasSavedTheme()) {
          applyTheme(event.matches ? 'dark' : 'light', false);
        }
      };
      if (media.addEventListener) media.addEventListener('change', onChange);
      else if (media.addListener) media.addListener(onChange);
    }
  }

  /* ---------- Прогресс ---------- */
  function loadProgress() {
    const saved = readJson(PROGRESS_KEY, []);
    if (!Array.isArray(saved)) return new Set();
    return new Set(saved.filter((id) => typeof id === 'string' && sectionIds.has(id)));
  }

  function saveProgress() {
    writeStorage(PROGRESS_KEY, JSON.stringify(Array.from(completed)));
  }

  function updateProgressUI() {
    const count = completed.size;
    const percent = totalSections ? Math.round((count / totalSections) * 100) : 0;
    const ratio = percent / 100;

    $$('[data-progress-bar]').forEach(function (bar) {
      bar.style.transform = 'scaleX(' + ratio + ')';
    });

    $$('[data-progress-track]').forEach(function (track) {
      track.setAttribute('aria-valuenow', String(percent));
      track.setAttribute('aria-valuetext', count + ' из ' + totalSections + ' разделов');
    });

    if (progressRing) progressRing.setAttribute('aria-valuenow', String(percent));
    if (ringFill) ringFill.style.strokeDashoffset = String(MAX_RING * (1 - ratio));
    setText(heroPct, percent + '%');
    setText(sidebarProgressPct, percent + '%');
    setText(mobileProgressPct, percent + '%');

    const baseText = count + ' из ' + totalSections;
    setText(sidebarProgressText, baseText);
    setText(mobileProgressText, baseText);

    if (heroProgressText) {
      let suffix = 'разделов · отметь первый';
      if (count === totalSections && totalSections > 0) suffix = '· курс пройден';
      else if (count > 0) suffix = 'разделов · продолжай';
      heroProgressText.textContent = baseText + ' ' + suffix;
    }

    if (heroStatus) {
      let status = 'В начале пути';
      if (count === totalSections && totalSections > 0) status = 'Курс пройден';
      else if (count >= totalSections - 1 && totalSections > 1) status = 'Финишная прямая';
      else if (percent >= 50) status = 'Половина позади';
      else if (count > 0) status = 'В процессе';
      heroStatus.textContent = status;
    }

    $$('[data-complete]').forEach(function (button) {
      const id = button.dataset.complete;
      const done = completed.has(id);
      const section = button.closest('[data-lesson]');
      const title = section ? sectionTitle(section) : id;

      button.classList.toggle('is-done', done);
      button.setAttribute('aria-pressed', String(done));
      button.setAttribute('aria-label', done
        ? 'Снять отметку с раздела «' + title + '»'
        : 'Отметить раздел «' + title + '» как изученный');

      const label = button.querySelector('span');
      if (label) label.textContent = done ? 'Изучено' : 'Отметить';
    });

    $$('[data-nav-item]').forEach(function (item) {
      item.classList.toggle('is-complete', completed.has(item.dataset.navItem));
    });

    if (quizSection) quizSection.classList.toggle('is-complete', completed.has('quiz'));
  }

  function toggleComplete(id) {
    if (!sectionIds.has(id)) return;
    if (completed.has(id)) completed.delete(id);
    else completed.add(id);
    saveProgress();
    updateProgressUI();
  }

  /* ---------- Навигация ---------- */
  function buildNavList(list) {
    if (!list) return;
    list.replaceChildren();
    let lastGroup = null;

    sections.forEach(function (section, index) {
      const group = section.dataset.group || 'Курс';
      if (group !== lastGroup) {
        const groupItem = document.createElement('li');
        groupItem.className = 'nav-group';
        groupItem.textContent = group;
        list.appendChild(groupItem);
        lastGroup = group;
      }

      const item = document.createElement('li');
      item.className = 'nav-item';
      item.dataset.navItem = section.id;

      const link = document.createElement('a');
      link.className = 'nav-link';
      link.href = '#' + section.id;
      link.dataset.navLink = section.id;

      const num = document.createElement('span');
      num.className = 'nav-num';
      num.textContent = padNumber(index + 1);

      const label = document.createElement('span');
      label.className = 'nav-label';
      label.textContent = section.dataset.short || sectionTitle(section);

      const state = document.createElement('span');
      state.className = 'nav-state';
      state.setAttribute('aria-hidden', 'true');

      link.append(num, label, state);
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  function buildNextLinks() {
    sections.forEach(function (section, index) {
      const next = sections[index + 1];
      const foot = section.querySelector('.lesson-foot');
      if (!next || !foot) return;

      const link = document.createElement('a');
      link.className = 'next-link';
      link.href = '#' + next.id;

      const text = document.createElement('span');
      const label = document.createElement('span');
      label.textContent = 'Далее';
      const title = document.createElement('strong');
      title.textContent = next.dataset.short || sectionTitle(next);
      text.append(label, title);

      link.append(text, makeIcon('M5 12h14M13 6l6 6-6 6'));
      foot.appendChild(link);
    });
  }

  function setActiveNav(id) {
    if (!id || id === currentActive) return;
    currentActive = id;

    $$('[data-nav-link]').forEach(function (link) {
      const active = link.dataset.navLink === id;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function initScroll() {
    let ticking = false;

    function update() {
      const header = $('.site-header');
      const headerHeight = header ? header.offsetHeight : 70;
      const probe = window.scrollY + headerHeight + 120;
      let active = sections.length ? sections[0].id : '';

      sections.forEach(function (section) {
        const top = section.getBoundingClientRect().top + window.scrollY;
        if (top <= probe) active = section.id;
      });

      setActiveNav(active);

      if (scrollProgressBar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        scrollProgressBar.style.transform = 'scaleX(' + ratio + ')';
      }
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        update();
      });
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('hashchange', requestUpdate);
    update();
  }

  /* ---------- Изображения ---------- */
  function renderFigure(slot) {
    const id = slot.dataset.image;
    const data = imageMap.get(id);
    const config = data || {
      src: PLACEHOLDER,
      alt: 'Изображение недоступно',
      caption: 'Для этого места не настроена картинка в js/images.js.'
    };

    const figure = document.createElement('figure');
    figure.className = 'lesson-figure';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'figure-btn';
    button.setAttribute('aria-label', 'Увеличить изображение: ' + (config.alt || config.caption || id));

    const isDiagram = /\.svg(?:\?|$)/i.test(config.src);
    if (isDiagram) button.classList.add('is-diagram');
    if (!data) button.classList.add('is-placeholder');

    const img = document.createElement('img');
    img.src = config.src;
    img.alt = config.alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.imageId = id;

    const caption = document.createElement('figcaption');
    caption.textContent = config.caption || '';

    const zoom = document.createElement('span');
    zoom.className = 'zoom-badge';
    zoom.append(makeIcon('M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3'), document.createTextNode('Увеличить'));

    img.addEventListener('error', function () {
      if (img.dataset.fallback === 'true') return;
      img.dataset.fallback = 'true';
      img.src = PLACEHOLDER;
      button.classList.remove('is-diagram');
      button.classList.add('is-placeholder');
      button.disabled = true;
      button.setAttribute('aria-label', 'Изображение недоступно');
      zoom.remove();
      caption.textContent = (config.caption ? config.caption + ' ' : '') + 'Файл не найден: ' + config.src;
    });

    button.addEventListener('click', function () {
      openLightbox(config.src, config.alt, config.caption);
    });

    button.append(img, zoom);
    figure.append(button, caption);
    slot.appendChild(figure);
  }

  function renderFigures() {
    $$('[data-image]').forEach(renderFigure);
  }

  /* ---------- Лайтбокс ---------- */
  function openLightbox(src, alt, caption) {
    if (!lightbox || !lightboxImg) return;

    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    setText(lightboxCaption, caption || '');

    if (typeof lightbox.showModal === 'function') {
      if (!lightbox.open) lightbox.showModal();
    } else {
      lightbox.setAttribute('open', '');
    }
    document.body.classList.add('modal-open');
  }

  function initLightbox() {
    if (!lightbox) return;

    if (lightboxClose) {
      lightboxClose.addEventListener('click', function () {
        lightbox.close();
      });
    }

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) lightbox.close();
    });

    lightbox.addEventListener('close', function () {
      document.body.classList.remove('modal-open');
      if (lightboxImg) {
        lightboxImg.removeAttribute('src');
        lightboxImg.alt = '';
      }
    });
  }

  /* ---------- Меню ---------- */
  function getMenuFocusables() {
    if (!mobileNav) return [];
    return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', mobileNav)
      .filter(function (element) {
        return element.offsetParent !== null;
      });
  }

  function onMenuKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getMenuFocusables();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openMenu() {
    if (!mobileNav || !menuToggle) return;
    lastFocused = document.activeElement;

    mobileNav.classList.add('is-open');
    mobileNav.setAttribute('aria-hidden', 'false');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Закрыть меню');
    document.body.classList.add('nav-open');

    if (navBackdrop) {
      window.clearTimeout(backdropTimer);
      navBackdrop.hidden = false;
      window.requestAnimationFrame(function () {
        navBackdrop.classList.add('is-open');
      });
    }

    document.addEventListener('keydown', onMenuKeydown);
    if (menuClose) window.setTimeout(function () { menuClose.focus(); }, 30);
  }

  function closeMenu(returnFocus) {
    if (!mobileNav || !menuToggle) return;

    mobileNav.classList.remove('is-open');
    mobileNav.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Открыть меню');
    document.body.classList.remove('nav-open');
    document.removeEventListener('keydown', onMenuKeydown);

    if (navBackdrop) {
      navBackdrop.classList.remove('is-open');
      window.clearTimeout(backdropTimer);
      backdropTimer = window.setTimeout(function () {
        if (!mobileNav.classList.contains('is-open')) navBackdrop.hidden = true;
      }, 280);
    }

    if (returnFocus && lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  function initMenu() {
    if (menuToggle) {
      menuToggle.addEventListener('click', function () {
        if (menuToggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
        else openMenu();
      });
    }

    if (menuClose) menuClose.addEventListener('click', function () { closeMenu(true); });

    if (navBackdrop) {
      navBackdrop.addEventListener('click', function () {
        if (navBackdrop.classList.contains('is-open')) closeMenu(true);
      });
    }

    if (mobileNav) {
      mobileNav.addEventListener('click', function (event) {
        if (event.target.closest('a[href]')) closeMenu(true);
      });
    }

    const media = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : null;
    if (media) {
      const onChange = function (event) {
        if (event.matches) closeMenu(false);
      };
      if (media.addEventListener) media.addEventListener('change', onChange);
      else if (media.addListener) media.addListener(onChange);
    }
  }

  /* ---------- Тост ---------- */
  function hideToast() {
    if (!toast) return;
    toast.classList.remove('is-visible');
    window.clearTimeout(toastTimer);
  }

  function showToast(message, options) {
    if (!toast) return;
    const settings = options || {};
    const duration = typeof settings.duration === 'number' ? settings.duration : 3400;

    setText(toastMessage, message);

    if (toastAction) {
      if (settings.action) {
        toastAction.hidden = false;
        toastAction.textContent = settings.action;
        toastAction.onclick = function () {
          hideToast();
          if (typeof settings.onAction === 'function') settings.onAction();
        };
      } else {
        toastAction.hidden = true;
        toastAction.onclick = null;
      }
    }

    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    if (duration > 0) toastTimer = window.setTimeout(hideToast, duration);
  }

  /* ---------- Мини-тест ---------- */
  function updateQuizBest() {
    if (!quizBestEl) return;
    if (quizBest < 0) {
      quizBestEl.textContent = 'Лучший результат: —';
    } else {
      quizBestEl.textContent = 'Лучший результат: ' + quizBest + ' из ' + (quizData ? quizData.questions.length : 7);
    }
  }

  function resetQuiz() {
    if (!quizForm || !quizQuestions) return;

    quizForm.reset();
    $$('.quiz-question', quizQuestions).forEach(function (fieldset) {
      fieldset.classList.remove('is-missing', 'is-graded');
      $$('.quiz-option', fieldset).forEach(function (option) {
        option.classList.remove('is-correct', 'is-wrong');
      });
      $$('input', fieldset).forEach(function (input) {
        input.disabled = false;
      });
      const explanation = $('.quiz-explanation', fieldset);
      if (explanation) {
        explanation.classList.remove('is-visible');
        explanation.replaceChildren();
      }
    });

    if (quizResult) {
      quizResult.hidden = true;
      quizResult.classList.remove('is-pass', 'is-fail');
      quizResult.removeAttribute('tabindex');
    }
    if (quizSubmit) {
      quizSubmit.disabled = false;
      quizSubmit.textContent = 'Проверить ответы';
    }
    if (quizRetry) quizRetry.hidden = true;
    if (quizStatus) {
      quizStatus.textContent = '';
      quizStatus.classList.remove('is-ok');
    }
  }

  function buildQuiz() {
    if (!quizForm || !quizQuestions) return;

    if (!quizData || !Array.isArray(quizData.questions) || !quizData.questions.length) {
      quizForm.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();

    quizData.questions.forEach(function (question, questionIndex) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'quiz-question';
      fieldset.dataset.question = String(questionIndex);

      const legend = document.createElement('legend');
      const num = document.createElement('span');
      num.className = 'q-num';
      num.textContent = padNumber(questionIndex + 1);
      legend.append(num, document.createTextNode(' ' + question.question));

      const options = document.createElement('div');
      options.className = 'quiz-options';

      question.options.forEach(function (optionText, optionIndex) {
        const label = document.createElement('label');
        label.className = 'quiz-option';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'q' + questionIndex;
        input.value = String(optionIndex);

        const text = document.createElement('span');
        text.textContent = optionText;

        label.append(input, text);
        options.appendChild(label);
      });

      const explanation = document.createElement('div');
      explanation.className = 'quiz-explanation';
      explanation.id = 'quiz-explanation-' + questionIndex;

      fieldset.append(legend, options, explanation);
      fragment.appendChild(fieldset);
    });

    quizQuestions.replaceChildren(fragment);

    const scoreTotal = document.querySelector('.quiz-score span');
    if (scoreTotal) scoreTotal.textContent = '/ ' + quizData.questions.length;

    const passBadge = $('.quiz-meta .badge-soft');
    if (passBadge) passBadge.textContent = 'Проходной балл: ' + quizData.passScore + ' из ' + quizData.questions.length;
  }

  function handleQuizSubmit(event) {
    event.preventDefault();
    if (!quizData || !quizQuestions) return;

    const fieldsets = $$('.quiz-question', quizQuestions);
    const selected = fieldsets.map(function (fieldset) {
      return $('input[type="radio"]:checked', fieldset);
    });
    const missing = [];

    selected.forEach(function (input, index) {
      if (!input) {
        missing.push(fieldsets[index]);
        fieldsets[index].classList.add('is-missing');
      } else {
        fieldsets[index].classList.remove('is-missing');
      }
    });

    if (missing.length) {
      if (quizStatus) {
        quizStatus.textContent = 'Ответь на все вопросы: осталось ' + missing.length + '.';
        quizStatus.classList.remove('is-ok');
      }
      missing[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = $('input', missing[0]);
      if (firstInput) {
        window.setTimeout(function () { firstInput.focus({ preventScroll: true }); }, 220);
      }
      return;
    }

    if (quizStatus) {
      quizStatus.textContent = '';
      quizStatus.classList.remove('is-ok');
    }

    let score = 0;
    const weakTopics = [];

    fieldsets.forEach(function (fieldset, questionIndex) {
      const question = quizData.questions[questionIndex];
      const chosen = Number(selected[questionIndex].value);
      fieldset.classList.add('is-graded');

      $$('.quiz-option', fieldset).forEach(function (option, optionIndex) {
        option.classList.remove('is-correct', 'is-wrong');
        if (optionIndex === question.correct) option.classList.add('is-correct');
        else if (optionIndex === chosen) option.classList.add('is-wrong');
      });

      const explanation = $('.quiz-explanation', fieldset);
      if (explanation) {
        explanation.replaceChildren();
        const strong = document.createElement('strong');
        if (chosen === question.correct) {
          score += 1;
          strong.textContent = 'Верно.';
        } else {
          strong.textContent = 'Правильный ответ: ' + question.options[question.correct] + '.';
          if (question.topic) {
            weakTopics.push({
              id: question.topic,
              title: question.topicTitle || question.topic
            });
          }
        }
        explanation.append(strong, document.createTextNode(' ' + (question.explanation || '')));
        explanation.classList.add('is-visible');
      }

      $$('input', fieldset).forEach(function (input) { input.disabled = true; });
    });

    const total = quizData.questions.length;
    const passed = score >= quizData.passScore;

    if (quizScoreEl) quizScoreEl.textContent = String(score);
    if (quizVerdictBadge) quizVerdictBadge.textContent = passed ? 'Засчитано' : 'Пока нет';
    if (quizVerdict) {
      if (score === total) quizVerdict.textContent = 'Идеально. База уверенная — можно паять.';
      else if (passed) quizVerdict.textContent = 'Хороший результат. Ошибки уже разобраны ниже.';
      else if (score >= 3) quizVerdict.textContent = 'Начало положено, но пара тем пока хромает.';
      else quizVerdict.textContent = 'Пока рано брать паяльник — вернись к теории и попробуй снова.';
    }

    if (quizHint) {
      quizHint.replaceChildren();
      const unique = Array.from(new Map(weakTopics.map(function (item) { return [item.id, item]; })).values());

      if (unique.length) {
        quizHint.appendChild(document.createTextNode('Стоит повторить: '));
        unique.forEach(function (topic, index) {
          const link = document.createElement('a');
          link.href = '#' + topic.id;
          link.textContent = topic.title;
          quizHint.appendChild(link);
          if (index < unique.length - 1) quizHint.appendChild(document.createTextNode(', '));
        });
        quizHint.appendChild(document.createTextNode('.'));
      } else {
        quizHint.textContent = 'Все темы теста закрыты. Можно переходить к практике.';
      }
    }

    if (quizResult) {
      quizResult.hidden = false;
      quizResult.classList.toggle('is-pass', passed);
      quizResult.classList.toggle('is-fail', !passed);
    }

    if (quizStatus) {
      quizStatus.textContent = passed
        ? 'Тест засчитан — раздел добавлен в прогресс.'
        : 'Не хватает баллов: ' + (quizData.passScore - score) + '. Разбор ниже поможет.';
      quizStatus.classList.toggle('is-ok', passed);
    }

    if (quizSubmit) {
      quizSubmit.disabled = true;
      quizSubmit.textContent = 'Проверено';
    }
    if (quizRetry) quizRetry.hidden = false;

    if (score > quizBest) {
      quizBest = score;
      writeStorage(QUIZ_KEY, String(score));
    }
    updateQuizBest();

    if (passed) {
      completed.add('quiz');
      saveProgress();
      updateProgressUI();
    }

    if (quizResult) {
      quizResult.setAttribute('tabindex', '-1');
      quizResult.focus({ preventScroll: true });
      quizResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function initQuiz() {
    if (!quizForm || !quizQuestions) return;

    buildQuiz();
    updateQuizBest();

    quizForm.addEventListener('submit', handleQuizSubmit);

    quizQuestions.addEventListener('change', function (event) {
      const input = event.target;
      if (!input.matches('input[type="radio"]')) return;
      const fieldset = input.closest('.quiz-question');
      if (fieldset) fieldset.classList.remove('is-missing');
      if (quizStatus) {
        quizStatus.textContent = '';
        quizStatus.classList.remove('is-ok');
      }
    });

    if (quizRetry) {
      quizRetry.addEventListener('click', function () {
        resetQuiz();
        quizForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    resetQuizState = resetQuiz;
  }

  /* ---------- Сброс прогресса ---------- */
  function resetAll() {
    completed.clear();
    quizBest = -1;
    removeStorage(PROGRESS_KEY);
    removeStorage(QUIZ_KEY);

    updateProgressUI();
    updateQuizBest();
    if (resetQuizState) resetQuizState();

    showToast('Прогресс сброшен. Можно начать заново.');
  }

  function openResetDialog() {
    if (resetDialog && typeof resetDialog.showModal === 'function') {
      if (!resetDialog.open) resetDialog.showModal();
      document.body.classList.add('modal-open');
      return;
    }
    if (window.confirm('Сбросить прогресс и лучший результат теста?')) resetAll();
  }

  function initReset() {
    $$('[data-reset]').forEach(function (button) {
      button.addEventListener('click', openResetDialog);
    });

    if (resetCancel) {
      resetCancel.addEventListener('click', function () {
        if (resetDialog) resetDialog.close();
      });
    }

    if (resetConfirm) {
      resetConfirm.addEventListener('click', function () {
        resetAll();
        if (resetDialog) resetDialog.close();
      });
    }

    if (resetDialog) {
      resetDialog.addEventListener('click', function (event) {
        if (event.target === resetDialog) resetDialog.close();
      });
      resetDialog.addEventListener('close', function () {
        document.body.classList.remove('modal-open');
      });
    }
  }

  /* ---------- Установка PWA ---------- */
  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
  }

  function initInstall() {
    if (!installBtn) return;

    if (isStandalone()) {
      installBtn.hidden = true;
    } else if (isIos()) {
      installBtn.hidden = false;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      installBtn.hidden = false;
    });

    installBtn.addEventListener('click', async function () {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try {
          const choice = await deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') showToast('Приложение установлено. Ищи иконку на домашнем экране.');
        } catch (error) {
          /* Пользователь закрыл диалог — ничего страшного. */
        }
        deferredInstallPrompt = null;
        installBtn.hidden = true;
        return;
      }

      if (isIos()) {
        showToast('На iPhone: кнопка «Поделиться» → «На экран Домой».', { duration: 6200 });
      } else {
        showToast('Открой меню браузера и выбери «Установить приложение».', { duration: 5200 });
      }
    });

    window.addEventListener('appinstalled', function () {
      installBtn.hidden = true;
      showToast('Приложение установлено. Теперь курс доступен офлайн.');
    });
  }

  /* ---------- Сеть и Service Worker ---------- */
  function updateNetworkStatus() {
    if (!netStatus) return;
    const online = navigator.onLine;
    netStatus.dataset.state = online ? 'online' : 'offline';
    setText($('.status-label', netStatus), online ? 'Онлайн' : 'Офлайн');
    netStatus.setAttribute('title', online ? 'Есть подключение к сети' : 'Нет сети — открыты сохранённые уроки');
  }

  function initNetwork() {
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
  }

  function initServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').then(function (registration) {
        function offerUpdate(worker) {
          if (!worker || updateOffered) return;
          updateOffered = true;
          showToast('Доступна новая версия курса.', {
            action: 'Обновить',
            duration: 15000,
            onAction: function () {
              refreshing = true;
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }

        if (registration.waiting && navigator.serviceWorker.controller) {
          offerUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', function () {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              offerUpdate(worker);
            }
          });
        });
      }).catch(function (error) {
        console.warn('Service Worker не зарегистрирован:', error);
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) {
        refreshing = false;
        window.location.reload();
      }
    });
  }

  /* ---------- Инициализация ---------- */
  completed = loadProgress();
  quizBest = (function () {
    const saved = Number(readJson(QUIZ_KEY, -1));
    return Number.isInteger(saved) && saved >= 0 ? saved : -1;
  })();

  sections.forEach(function (section, index) {
    $$('[data-num]', section).forEach(function (num) {
      num.textContent = padNumber(index + 1);
    });
  });

  buildNavList(sidebarNav);
  buildNavList(mobileNavList);
  buildNextLinks();
  renderFigures();
  updateProgressUI();

  $$('[data-complete]').forEach(function (button) {
    button.addEventListener('click', function () {
      toggleComplete(button.dataset.complete);
    });
  });

  initTheme();
  initMenu();
  initLightbox();
  initQuiz();
  initReset();
  initInstall();
  initNetwork();
  initServiceWorker();
  initScroll();
})();
