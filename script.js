(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const deck = document.querySelector('#deck');
  const shells = [...document.querySelectorAll('.slide-shell')];
  const currentLabel = document.querySelector('#currentSlide');
  const motion = window.gsap;
  let current = 0;
  let transitioning = false;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let resizeFrame = 0;
  let wheelDelta = 0;
  let wheelResetTimer = 0;
  let pointerStartY = null;
  let pageTimeline = null;
  const introTimelines = new WeakMap();

  function fitStage() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--stage-scale', String(Math.min(width / 1600, height / 900)));
    });
  }

  function cleanMotionClasses(shell) {
    shell.classList.remove('is-entering', 'is-leaving');
  }

  function basicSettle(index) {
    current = index;
    currentLabel.textContent = String(index + 1);
    shells.forEach((shell, shellIndex) => {
      cleanMotionClasses(shell);
      const active = shellIndex === index;
      shell.classList.toggle('is-active', active);
      shell.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }

  if (!motion) {
    document.documentElement.classList.remove('js');
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-next]');
      if (button) basicSettle(Number(button.dataset.next));
    });
    window.addEventListener('resize', fitStage, { passive: true });
    fitStage();
    basicSettle(0);
    return;
  }

  const motionMedia = motion.matchMedia();
  motionMedia.add(
    {
      reduceMotion: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      reducedMotion = Boolean(context.conditions.reduceMotion);
    },
  );

  function clearShellProps(shell) {
    motion.set(shell, { clearProps: 'opacity,visibility,transform,willChange' });
  }

  function clearContentProps(shell) {
    const animated = shell.querySelectorAll('.reveal, .next-button, .cover-curtain, .cover-wave, .start-button');
    shell.classList.remove('is-content-entering');
    motion.killTweensOf(animated);
    motion.set(animated, {
      clearProps: 'opacity,visibility,transform,willChange',
    });
  }

  function settleOn(index, { animate = false } = {}) {
    pageTimeline?.kill();
    pageTimeline = null;
    shells.forEach((shell) => {
      introTimelines.get(shell)?.kill();
      clearShellProps(shell);
      clearContentProps(shell);
    });
    basicSettle(index);
    if (animate) playIntro(shells[index]);
  }

  function buildCoverIntro(shell) {
    const brand = shell.querySelector('.brand');
    const title = shell.querySelector('.cover-title-composite');
    const copy = shell.querySelector('.cover-copy');
    const leftPhone = shell.querySelector('.cover-phone-left');
    const backPhone = shell.querySelector('.cover-phone-back');
    const rightPhone = shell.querySelector('.cover-phone-right');
    const curtain = shell.querySelector('.cover-curtain');
    const button = shell.querySelector('.start-button');
    const timeline = motion.timeline({ paused: true, defaults: { ease: 'power3.out' } });

    if (reducedMotion) {
      timeline.set([brand, title, copy, leftPhone, backPhone, rightPhone, curtain, button], {
        autoAlpha: 1,
        clearProps: 'opacity,visibility,transform',
      });
      return timeline;
    }

    timeline
      .addLabel('coverIn', 0)
      .fromTo(brand, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.3, force3D: true, clearProps: 'opacity,visibility,transform' }, 'coverIn')
      .fromTo(
        title,
        { autoAlpha: 0, y: 12, scale: 0.97, rotation: -0.8 },
        { autoAlpha: 1, y: 0, scale: 1, rotation: -0.15, duration: 0.48, force3D: true, clearProps: 'opacity,visibility,transform' },
        'coverIn+=0.03',
      )
      .fromTo(copy, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.34, force3D: true, clearProps: 'opacity,visibility,transform' }, 'coverIn+=0.14')
      .fromTo(leftPhone, { autoAlpha: 0, y: 18, scale: 0.97, rotation: -11 }, { autoAlpha: 1, y: 0, scale: 1, rotation: -9.77, duration: 0.4, force3D: true, clearProps: 'opacity,visibility,transform' }, 'coverIn+=0.14')
      .fromTo(backPhone, { autoAlpha: 0, y: 20, scale: 0.98, rotation: 12.1 }, { autoAlpha: 1, y: 0, scale: 1, rotation: 11.08, duration: 0.42, force3D: true, clearProps: 'opacity,visibility,transform' }, 'coverIn+=0.2')
      .fromTo(rightPhone, { autoAlpha: 0, y: 17, scale: 0.98, rotation: 1.8 }, { autoAlpha: 1, y: 0, scale: 1, rotation: 0.91, duration: 0.42, force3D: true, clearProps: 'opacity,visibility,transform' }, 'coverIn+=0.25')
      .fromTo(curtain, { autoAlpha: 0, y: 40, rotation: 0.2 }, { autoAlpha: 1, y: 0, rotation: 0, duration: 0.45, force3D: true, clearProps: 'opacity,visibility,transform' }, 'coverIn+=0.22')
      .fromTo(button, { autoAlpha: 0, y: 8, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, force3D: true, clearProps: 'opacity,visibility,transform' }, 'coverIn+=0.38');

    return timeline;
  }

  function buildSlideIntro(shell) {
    const chrome = [...shell.querySelectorAll('.brand, .page-number')];
    const heading = shell.querySelector('.slide-heading');
    const blocks = [...shell.querySelectorAll('.reveal')].filter(
      (element) => !element.matches('.brand, .page-number, .slide-heading'),
    );
    const nextButton = shell.querySelector('.next-button');
    const timeline = motion.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const all = [...chrome, heading, ...blocks, nextButton].filter(Boolean);

    if (reducedMotion) {
      timeline.set(all, {
        autoAlpha: 1,
        clearProps: 'opacity,visibility,transform',
      });
      return timeline;
    }

    timeline
      .addLabel('contentIn', 0)
      .fromTo(chrome, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.02, force3D: true, clearProps: 'opacity,visibility,transform' }, 'contentIn')
      .fromTo(
        heading,
        { autoAlpha: 0, x: -18 },
        { autoAlpha: 1, x: 0, duration: 0.36, force3D: true, clearProps: 'opacity,visibility,transform' },
        'contentIn+=0.03',
      )
      .fromTo(
        blocks,
        { autoAlpha: 0, y: 14, scale: 0.996 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.38,
          stagger: { amount: Math.min(0.18, Math.max(0, blocks.length - 1) * 0.035), from: 'start' },
          force3D: true,
          clearProps: 'opacity,visibility,transform',
        },
        'contentIn+=0.09',
      )
      .fromTo(nextButton, { autoAlpha: 0, y: 8, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, force3D: true, clearProps: 'opacity,visibility,transform' }, 'contentIn+=0.25');

    return timeline;
  }

  function buildIntro(shell) {
    introTimelines.get(shell)?.kill();
    clearContentProps(shell);
    const timeline = shell.dataset.slide === '0' ? buildCoverIntro(shell) : buildSlideIntro(shell);
    timeline.eventCallback('onStart', () => shell.classList.add('is-content-entering'));
    timeline.eventCallback('onComplete', () => shell.classList.remove('is-content-entering'));
    timeline.eventCallback('onInterrupt', () => shell.classList.remove('is-content-entering'));
    introTimelines.set(shell, timeline);
    return timeline;
  }

  function playIntro(shell) {
    buildIntro(shell).play(0);
  }

  function transitionTo(index) {
    const next = Math.max(0, Math.min(shells.length - 1, index));
    if (transitioning || next === current) return;

    const previousIndex = current;
    const previous = shells[previousIndex];
    const target = shells[next];
    const forward = next > previousIndex;
    const intro = buildIntro(target);

    transitioning = true;
    pageTimeline?.kill();
    cleanMotionClasses(previous);
    cleanMotionClasses(target);
    previous.classList.add('is-leaving');
    target.classList.add('is-active', 'is-entering');
    previous.setAttribute('aria-hidden', 'true');
    target.setAttribute('aria-hidden', 'false');
    current = next;
    currentLabel.textContent = String(next + 1);

    motion.set([previous, target], { willChange: 'transform,opacity' });

    pageTimeline = motion.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        previous.classList.remove('is-active');
        cleanMotionClasses(previous);
        cleanMotionClasses(target);
        clearShellProps(previous);
        clearShellProps(target);
        clearContentProps(previous);
        if (previousIndex === 0) {
          const coverStage = previous.querySelector('.cover-stage');
          const startButton = previous.querySelector('.start-button');
          coverStage.classList.remove('is-departing');
          startButton.disabled = false;
        }
        transitioning = false;
        pageTimeline = null;
      },
    });

    if (reducedMotion) {
      pageTimeline
        .set(target, { autoAlpha: 0 })
        .to(previous, { autoAlpha: 0, duration: 0.12, ease: 'power1.out' }, 0)
        .to(target, { autoAlpha: 1, duration: 0.16, ease: 'power1.out' }, 0.06)
        .add(intro, 0.06);
      intro.paused(false);
      return;
    }

    motion.set(target, {
      autoAlpha: 0,
      y: forward ? 28 : -22,
      scale: 0.997,
      force3D: true,
    });

    pageTimeline
      .to(previous, { autoAlpha: 0, y: forward ? -10 : 10, scale: 0.998, duration: 0.22, ease: 'power2.in', force3D: true }, 0)
      .to(target, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, ease: 'power3.out', force3D: true }, 0.04)
      .add(intro, 0.08);
    intro.paused(false);
  }

  function leaveCover() {
    if (transitioning || current !== 0) return;
    const coverStage = shells[0].querySelector('.cover-stage');
    const curtain = coverStage.querySelector('.cover-curtain');
    const button = coverStage.querySelector('.start-button');

    transitioning = true;
    button.disabled = true;
    coverStage.classList.add('is-departing');
    motion.killTweensOf([curtain, button]);
    motion.set(curtain, { willChange: 'transform' });

    const exitTimeline = motion.timeline({
      onComplete: () => {
        transitioning = false;
        transitionTo(1);
      },
    });

    if (reducedMotion) {
      exitTimeline.to(curtain, { autoAlpha: 0, duration: 0.12, ease: 'power1.out' });
      return;
    }

    exitTimeline
      .to(button, { scale: 0.97, rotation: 0, duration: 0.12, ease: 'power2.in' }, 0)
      .to(curtain, { y: 360, rotation: 0.28, duration: 0.46, ease: 'power3.in', force3D: true }, 0.03);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-next]');
    if (!button) return;
    const next = Number(button.dataset.next);
    if (current === 0 && next === 1) leaveCover();
    else transitionTo(next);
  });

  deck.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (current === 0 || transitioning) return;
    wheelDelta += event.deltaY;
    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => { wheelDelta = 0; }, 160);
    if (Math.abs(wheelDelta) < 54) return;
    const direction = wheelDelta > 0 ? 1 : -1;
    wheelDelta = 0;
    transitionTo(current + direction);
  }, { passive: false });

  deck.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || current === 0) return;
    pointerStartY = event.clientY;
  }, { passive: true });

  deck.addEventListener('pointerup', (event) => {
    if (pointerStartY === null || transitioning) return;
    const distance = pointerStartY - event.clientY;
    pointerStartY = null;
    if (Math.abs(distance) < 48) return;
    transitionTo(current + (distance > 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    const forward = ['ArrowDown', 'ArrowRight', 'PageDown', ' '];
    const backward = ['ArrowUp', 'ArrowLeft', 'PageUp'];
    if (forward.includes(event.key)) {
      event.preventDefault();
      if (current === 0) leaveCover();
      else transitionTo(current + 1);
    } else if (backward.includes(event.key)) {
      event.preventDefault();
      transitionTo(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      transitionTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      transitionTo(shells.length - 1);
    }
  });

  window.addEventListener('resize', fitStage, { passive: true });
  window.visualViewport?.addEventListener('resize', fitStage, { passive: true });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) settleOn(0, { animate: true });
  });

  fitStage();
  settleOn(0, { animate: true });
})();
