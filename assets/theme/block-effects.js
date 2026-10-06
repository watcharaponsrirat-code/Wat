(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#8dfaff', '#d8adff', '#74c9ff', '#ffe9ac', '#ffffff'];
  let layer;
  // Capture the activation before navigation replaces the clicked element.
  // The overlay never intercepts clicks, scrolling, focus, or game controls.
  document.addEventListener('click', event => {
    if (reducedMotion.matches || !(event.target instanceof Element)) return;
    const target = event.target.closest('button, [data-grade], [data-unit], [data-lesson]');
    if (!target || target.matches(':disabled,[aria-disabled="true"]')) return;
    const rect = target.getBoundingClientRect();
    const x = event.detail ? event.clientX : rect.left + rect.width / 2;
    const y = event.detail ? event.clientY : rect.top + rect.height / 2;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'blockParticles';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
    }
    while (layer.childElementCount > 48) layer.firstElementChild.remove();
    for (let i = 0; i < 8; i++) {
      const particle = document.createElement('i');
      particle.className = 'blockParticle';
      const angle = i * Math.PI / 4;
      particle.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(angle) * (28 + Math.random() * 24)}px;--dy:${Math.sin(angle) * (28 + Math.random() * 24)}px;--particle-color:${colors[i % colors.length]}`;
      layer.append(particle);
      window.setTimeout(() => particle.remove(), 550);
    }
  }, {capture: true, passive: true});
  reducedMotion.addEventListener('change', () => layer?.replaceChildren());
})();
