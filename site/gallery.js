(async function () {
  const { escapeHtml, sitePath, loadJson, sortByDateDesc, sortImagesBySeq, renderBodyText, showDataError, applyPageHeading } = DTPLab;
  const root = document.querySelector("#gallery-content");
  const dialog = document.querySelector("#gallery-lightbox");
  const dialogImage = document.querySelector("#lightbox-image");
  const dialogCaption = document.querySelector("#lightbox-caption");
  let activeImages = [], activeIndex = 0, trigger = null;
  const thumbnailMarkup = (image, fallbackAlt) => `<img src="${escapeHtml(sitePath(image.thumbnail || image.src))}" alt="${escapeHtml(image.alt || fallbackAlt || "")}" width="640" height="360" loading="lazy" decoding="async">`;
  const showImage = () => { const image = activeImages[activeIndex]; dialogImage.src = sitePath(image.src); dialogImage.alt = image.alt || ""; dialogCaption.textContent = image.caption || image.alt || ""; };
  const move = (direction) => { activeIndex = (activeIndex + direction + activeImages.length) % activeImages.length; showImage(); };
  const open = (images, index, button) => { activeImages = images; activeIndex = index; trigger = button; showImage(); dialog.showModal(); };
  try {
    const data = await loadJson("gallery.json");
    applyPageHeading(data.page);
    const events = sortByDateDesc(data.events).map((event) => ({ event, images: sortImagesBySeq(event.images || []) }));
    root.innerHTML = events.map(({ event, images }, eventIndex) => {
      const thumbnailImages = images.slice(0, 4);
      const classes = ["gallery-event", images.length ? "has-images" : ""].filter(Boolean).join(" ");
      const description = renderBodyText(event.description);
      return `<article class="${classes}"><div class="gallery-event-meta"><time datetime="${escapeHtml(event.date)}">${escapeHtml(event.date)}</time></div><h2>${escapeHtml(event.title)}</h2>${description ? `<div class="gallery-event-description body-text">${description}</div>` : ""}${images.length ? `<div class="gallery-grid">${thumbnailImages.map((image, imageIndex) => `<button class="gallery-thumb" type="button" data-event="${eventIndex}" data-image="${imageIndex}" aria-label="${escapeHtml(image.alt || event.title)} 크게 보기">${thumbnailMarkup(image, event.title)}</button>`).join("")}</div>` : ""}</article>`;
    }).join("") || '<p class="empty-state">등록된 행사가 없습니다.</p>';
    root.querySelectorAll(".gallery-thumb").forEach((button) => button.addEventListener("click", () => open(events[Number(button.dataset.event)].images, Number(button.dataset.image), button)));
  } catch (error) { showDataError(root, error); }
  dialog.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".lightbox-prev").addEventListener("click", () => move(-1));
  dialog.querySelector(".lightbox-next").addEventListener("click", () => move(1));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
    if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
  });
  dialog.addEventListener("close", () => trigger?.focus());
})();
