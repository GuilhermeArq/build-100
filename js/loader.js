(function initLoader() {
  function startAnimation() {
    const path = document.getElementById("loading-path");
    const arrow = document.getElementById("loading-arrow");
    const logo = document.getElementById("loading-logo");
    const brandRow = document.getElementById("loading-brand-row");
    const uia = document.getElementById("loading-uia");
    const subtitle = document.getElementById("loading-subtitle");

    if (!path || !arrow || !logo || !brandRow || !uia || !subtitle) {
      document.body.classList.remove("is-loading");
      return;
    }

    const totalLength = path.getTotalLength();
    const svgNS = "http://www.w3.org/2000/svg";
    const introPath = document.createElementNS(svgNS, "path");
    introPath.setAttribute("d", "M -2500 100 L 125 100 C 180 100, 180 65, 156.569 43.431");
    const introLength = introPath.getTotalLength();

    const visibleLength = 58;
    const duration = 3400; // Animação mais ágil e fluida (~3.4s)
    const delay = 0;
    const pauseAfterDrawing = 300;

    const uiaWidth = uia.offsetWidth;
    brandRow.style.transform = `translateX(${uiaWidth / 2}px)`;

    let startTime = null;

    function easeInOutQuart(x) {
      return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
    }

    function draw(progress) {
      const head = visibleLength + progress * (totalLength - visibleLength);
      let tail = head - visibleLength;

      if (tail > introLength) {
        tail = introLength;
      }

      path.style.strokeDasharray = `${head - tail} ${totalLength}`;
      path.style.strokeDashoffset = -tail;

      const point = path.getPointAtLength(head);
      const pointBehind = path.getPointAtLength(Math.max(0, head - 1));
      const angle = Math.atan2(point.y - pointBehind.y, point.x - pointBehind.x) * 180 / Math.PI;

      arrow.setAttribute("transform", `translate(${point.x}, ${point.y}) rotate(${angle})`);
    }

    function animate(time) {
      if (!startTime) startTime = time;

      const elapsed = time - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);
      const progress = easeInOutQuart(rawProgress);

      draw(progress);

      if (rawProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(finishLoading, pauseAfterDrawing);
      }
    }

    function finishLoading() {
      brandRow.style.transition = "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
      brandRow.style.transform = "translateX(0)";
      uia.classList.add("is-visible");

      setTimeout(() => {
        subtitle.classList.add("is-visible");
      }, 400);

      setTimeout(() => {
        document.body.classList.remove("is-loading");
      }, 1300);
    }

    draw(0);
    requestAnimationFrame(animate);
  }

  if (document.readyState === "interactive" || document.readyState === "complete") {
    startAnimation();
  } else {
    document.addEventListener("DOMContentLoaded", startAnimation);
  }
})();
