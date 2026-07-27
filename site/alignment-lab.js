(async function () {
  const { escapeHtml, loadJson, showDataError } = DTPLab;
  const { renderProjectCard, renderPublicationCard, renderSeminarCard } = DTPLab.recordRenderers;
  const threshold = 1.5;
  const suiteRoots = {
    project: document.querySelector("#qa-projects"),
    publication: document.querySelector("#qa-publications"),
    seminar: document.querySelector("#qa-seminars"),
  };
  const summaryRoot = document.querySelector("#qa-summary");
  const environmentRoot = document.querySelector("#qa-environment");
  const copyButton = document.querySelector("#qa-copy-report");
  let latestReport = null;
  let resizeTimer = 0;

  const widths = [
    { id: "320", label: "320px", value: "320px" },
    { id: "390", label: "390px", value: "390px" },
    { id: "full", label: "available", value: "100%" },
  ];
  const compactWidths = widths.slice(0, 2);

  const createProjectStressCases = () => {
    const programs = [
      { id: "short", value: "한화오션" },
      { id: "medium", value: "RISE 산학공동 기술개발과제" },
      { id: "long", value: "과기부-이노폴리스(연구특구진흥재단)" },
    ];
    const keywordSets = [
      { id: "k0", value: [] },
      { id: "k1", value: ["Optimization"] },
      { id: "k3", value: ["Digital Twin", "Reinforcement Learning", "Optimization"] },
      { id: "k5", value: ["Digital Twin", "Reinforcement Learning", "Optimization", "Surrogate Modeling", "Energy Systems"] },
    ];
    return programs.flatMap((program) => keywordSets.flatMap((keywords) => widths.map((width) => {
      const id = `project-stress-${program.id}-${keywords.id}-${width.id}`;
      return {
        id,
        label: `${program.value} · ${keywords.value.length} keywords · ${width.label}`,
        width,
        html: renderProjectCard({
          id,
          status: "current",
          category: "industry",
          title: "디지털트윈·강화학습 기반 메타데이터 정렬 진단",
          program: program.value,
          sponsor: "",
          managingAgency: "",
          period: { start: "2025.06", end: "2026.02" },
          keywords: keywords.value,
        }, { diagnostic: true }),
      };
    })));
  };

  const createPublicationStressCases = () => {
    const authorSets = [
      [{ name: "Won-Suk Kim", isLabMember: true, isFirstAuthor: true, isCorrespondingAuthor: true }],
      [
        { name: "Chang-Min Lee", isLabMember: true, isFirstAuthor: true, isCorrespondingAuthor: false },
        { name: "Nobuyoshi Komuro", isLabMember: false, isFirstAuthor: false, isCorrespondingAuthor: false },
        { name: "Won-Suk Kim", isLabMember: true, isFirstAuthor: false, isCorrespondingAuthor: true },
        { name: "Younghwan Yoo", isLabMember: false, isFirstAuthor: false, isCorrespondingAuthor: false },
      ],
      [
        { name: "Min-Jae Kim", isLabMember: true, isFirstAuthor: true, isCorrespondingAuthor: false },
        { name: "Ho-Jin Choi", isLabMember: true, isFirstAuthor: true, isCorrespondingAuthor: false },
        { name: "Nobuyoshi Komuro", isLabMember: false, isFirstAuthor: false, isCorrespondingAuthor: false },
        { name: "Jaeyoung Han", isLabMember: false, isFirstAuthor: false, isCorrespondingAuthor: true },
        { name: "Won-Suk Kim", isLabMember: true, isFirstAuthor: false, isCorrespondingAuthor: true },
        { name: "Alexandra Long-Name Researcher", isLabMember: false, isFirstAuthor: false, isCorrespondingAuthor: false },
        { name: "Additional Collaborator", isLabMember: false, isFirstAuthor: false, isCorrespondingAuthor: false },
      ],
    ];
    const venues = [
      { id: "short", venue: "Scientific Reports", details: "Vol. 15, pp. 32841" },
      { id: "long", venue: "IEEE Transactions on Industrial Informatics and Intelligent Systems", details: "Vol. 42, No. 12, pp. 1787-1799" },
    ];
    const keywordSets = [
      [],
      ["Optimization"],
      ["Digital Twin", "Reinforcement Learning", "Surrogate Modeling"],
    ];
    const types = ["journal", "conference", "patent"];
    let typeIndex = 0;
    return authorSets.flatMap((authors, authorIndex) => venues.flatMap((venue) => keywordSets.flatMap((keywords, keywordIndex) => compactWidths.map((width) => {
      const type = types[typeIndex++ % types.length];
      const id = `publication-stress-a${authorIndex + 1}-${venue.id}-k${keywords.length}-${width.id}`;
      const item = {
        id,
        type,
        publishedAt: "2026.07",
        title: "Content-independent icon and text alignment under multiline metadata wrapping",
        authors,
        venue: venue.venue,
        details: venue.details,
        metrics: type === "journal" ? { indexing: "SCIE", quartile: "Q1", topPercent: "", award: "", metricYear: "" } : {},
        patentStatus: type === "patent" ? "등록" : "",
        keywords,
        links: [],
      };
      return {
        id,
        label: `${type} · ${authors.length} authors · ${venue.id} venue · ${keywords.length} keywords · ${width.label}`,
        width,
        html: renderPublicationCard(item),
      };
    }))));
  };

  const createSeminarStressCases = () => {
    const titles = [
      "Short Seminar Title",
      "Function Approximation in Reinforcement Learning",
      "ORSO: Accelerating Reward Design via Online Reward Selection and Policy Optimization for Complex Systems",
    ];
    const speakers = ["이창민", "Alexandra Long-Name Researcher"];
    const keywordSets = [
      ["Optimization"],
      ["Reinforcement Learning", "Optimization"],
      ["Digital Twin", "Reinforcement Learning", "Optimization", "Surrogate Modeling"],
    ];
    return titles.flatMap((title, titleIndex) => speakers.flatMap((speaker, speakerIndex) => keywordSets.flatMap((keywords) => compactWidths.map((width) => {
      const id = `seminar-stress-t${titleIndex + 1}-s${speakerIndex + 1}-k${keywords.length}-${width.id}`;
      return {
        id,
        label: `${titleIndex + 1}-level title · ${speakerIndex ? "long" : "short"} speaker · ${keywords.length} keywords · ${width.label}`,
        width,
        html: renderSeminarCard({
          date: "2026.03.09",
          title,
          speaker,
          summary: "",
          keywords,
        }, { diagnostic: true }),
      };
    }))));
  };

  const specimenMarkup = (kind, specimen) => `<article class="qa-specimen qa-specimen-${kind}" id="${escapeHtml(specimen.id)}" data-qa-kind="${kind}" data-qa-case="${escapeHtml(specimen.id)}" style="--qa-specimen-width:${specimen.width.value}">
    <header class="qa-specimen-head">
      <div><code>${escapeHtml(specimen.id)}</code><p>${escapeHtml(specimen.label)}</p></div>
      <span class="qa-status">Pending</span>
    </header>
    <div class="qa-render${kind === "publication" ? " publication-cards-view" : ""}">${specimen.html}</div>
    <dl class="qa-metrics">
      <div><dt>max Δ</dt><dd data-qa-max>—</dd></div>
      <div><dt>pair Δ</dt><dd data-qa-pairs>—</dd></div>
      <div><dt>row spread</dt><dd data-qa-rows>—</dd></div>
      <div><dt>wraps</dt><dd data-qa-wraps>—</dd></div>
      <div><dt>overflow</dt><dd data-qa-overflow>—</dd></div>
    </dl>
  </article>`;

  const renderSuite = (root, title, description, kind, specimens) => {
    root.innerHTML = `<header class="qa-suite-heading"><div><p class="qa-label">${escapeHtml(kind)}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><strong>${specimens.length} cases</strong></header><div class="qa-specimen-list">${specimens.map((specimen) => specimenMarkup(kind, specimen)).join("")}</div>`;
  };

  const rectFromDomRect = (rect) => ({
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  });
  const centerY = (rect) => rect.top + rect.height / 2;
  const rounded = (value) => Number(value.toFixed(2));
  const roundedRect = (rect) => rect && Object.fromEntries(
    Object.entries(rect).map(([key, value]) => [key, rounded(value)]),
  );

  const firstTextRect = (element) => {
    if (!element) return null;
    if (element.matches(".keyword, .publication-tag")) return rectFromDomRect(element.getBoundingClientRect());
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const textNode = walker.nextNode();
    if (!textNode) return rectFromDomRect(element.getBoundingClientRect());
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = [...range.getClientRects()].find((candidate) => candidate.width > 0 && candidate.height > 0);
    return rect ? rectFromDomRect(rect) : rectFromDomRect(element.getBoundingClientRect());
  };

  const transformPoint = (matrix, x, y) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  });

  const paintedSvgRect = (svg) => {
    if (!svg) return null;
    const points = [];
    let failedShapes = 0;
    const shapes = [...svg.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon")];
    shapes.forEach((shape) => {
      try {
        const box = shape.getBBox();
        const matrix = shape.getScreenCTM();
        if (!matrix || (!box.width && !box.height)) {
          failedShapes += 1;
          return;
        }
        points.push(
          transformPoint(matrix, box.x, box.y),
          transformPoint(matrix, box.x + box.width, box.y),
          transformPoint(matrix, box.x, box.y + box.height),
          transformPoint(matrix, box.x + box.width, box.y + box.height),
        );
      } catch {
        failedShapes += 1;
      }
    });
    if (!points.length) {
      return {
        rect: rectFromDomRect(svg.getBoundingClientRect()),
        degraded: true,
        shapeCount: shapes.length,
        failedShapes,
      };
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      rect: {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      },
      degraded: failedShapes > 0,
      shapeCount: shapes.length,
      failedShapes,
    };
  };

  const makePair = (label, wrapper, iconSelector, targetSelector) => {
    const svg = wrapper?.querySelector(iconSelector);
    const target = wrapper?.querySelector(targetSelector);
    const painted = paintedSvgRect(svg);
    const iconRect = painted?.rect;
    const targetRect = firstTextRect(target);
    if (!iconRect || !targetRect) return null;
    const targetStyle = getComputedStyle(target);
    const iconCenter = centerY(iconRect);
    const targetCenter = centerY(targetRect);
    return {
      label,
      wrapper,
      wrapperRect: rectFromDomRect(wrapper.getBoundingClientRect()),
      svgRect: rectFromDomRect(svg.getBoundingClientRect()),
      svgViewBox: svg.getAttribute("viewBox") || "",
      measurementDegraded: painted.degraded,
      measuredShapes: painted.shapeCount,
      failedShapes: painted.failedShapes,
      iconRect,
      targetRect,
      targetStyle: {
        fontFamily: targetStyle.fontFamily,
        fontSize: targetStyle.fontSize,
        lineHeight: targetStyle.lineHeight,
      },
      iconCenter,
      targetCenter,
      delta: Math.abs(iconCenter - targetCenter),
      left: wrapper.getBoundingClientRect().left,
    };
  };

  const projectPairs = (specimen) => [...specimen.querySelectorAll(".project-meta-part")].map((part) => {
    const target = part.matches(".meta-keyword") ? ".keyword" : ".project-meta-value";
    const kind = [...part.classList].find((name) => name.startsWith("meta-")) || "meta";
    return makePair(kind, part, ".project-meta-icon svg", target);
  }).filter(Boolean);

  const publicationPairs = (specimen) => {
    const pairs = [];
    const authors = specimen.querySelector(".publication-authors-row");
    if (authors) pairs.push(makePair("authors", authors, ".publication-row-icon svg", ".authors"));
    specimen.querySelectorAll(".publication-meta-item").forEach((item) => {
      const keyword = item.matches(".publication-keywords-item");
      pairs.push(makePair(keyword ? "keywords" : "venue", item, ".publication-row-icon svg", keyword ? ".keyword" : ".publication-venue"));
    });
    return pairs.filter(Boolean);
  };

  const seminarPairs = (specimen) => {
    const pairs = [];
    const title = specimen.querySelector(".seminar-title-row");
    if (title) pairs.push(makePair("title", title, ".seminar-title-icon svg", ".seminar-title"));
    specimen.querySelectorAll(".seminar-meta-item").forEach((item) => {
      let target = ".speaker";
      let label = "speaker";
      if (item.matches(".seminar-date")) { target = "time"; label = "date"; }
      if (item.matches(".seminar-keywords")) { target = ".keyword"; label = "keywords"; }
      pairs.push(makePair(label, item, ".seminar-meta-icon svg", target));
    });
    return pairs.filter(Boolean);
  };

  const lineCount = (element) => {
    if (!element) return 0;
    if (element.matches(".keyword-row, .project-keywords")) {
      const tops = [...element.querySelectorAll(".keyword")].map((item) => Math.round(item.getBoundingClientRect().top));
      return new Set(tops).size;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    return new Set([...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).map((rect) => Math.round(rect.top))).size;
  };

  const measureWraps = (specimen) => {
    const selectors = [
      ".project-keywords",
      ".publication-authors-row .authors",
      ".publication-venue",
      ".publication-keywords-item .keyword-row",
      ".seminar-title",
      ".seminar-keywords .keyword-row",
    ];
    return selectors.map((selector) => {
      const element = specimen.querySelector(selector);
      const selectorParts = selector.split(" ");
      return element ? `${selectorParts[selectorParts.length - 1]}:${lineCount(element)}` : "";
    }).filter(Boolean);
  };

  const rowSpreads = (specimen, kind, pairs) => {
    const groups = [];
    const relevant = kind === "publication"
      ? pairs.filter((pair) => pair.label === "venue" || pair.label === "keywords")
      : kind === "seminar"
        ? pairs.filter((pair) => pair.label !== "title")
        : pairs;
    let previousLeft = -Infinity;
    relevant.forEach((pair) => {
      if (!groups.length || pair.left <= previousLeft + 1) groups.push([]);
      groups[groups.length - 1].push(pair);
      previousLeft = pair.left;
    });
    return groups.filter((group) => group.length > 1).map((group, index) => {
      const centers = group.map((pair) => pair.targetCenter);
      return {
        label: `row-${index + 1}`,
        spread: Math.max(...centers) - Math.min(...centers),
        members: group.map((pair) => pair.label),
      };
    });
  };

  const clearOverlays = (specimen) => specimen.querySelectorAll(".qa-centerline").forEach((line) => line.remove());
  const drawWorstPair = (specimen, pair) => {
    if (!pair) return;
    const render = specimen.querySelector(".qa-render");
    const renderRect = render.getBoundingClientRect();
    [
      { className: "qa-icon-line", top: pair.iconCenter - renderRect.top, label: `${pair.label} icon` },
      { className: "qa-target-line", top: pair.targetCenter - renderRect.top, label: `${pair.label} target` },
    ].forEach((line) => {
      const marker = document.createElement("span");
      marker.className = `qa-centerline ${line.className}`;
      marker.style.top = `${line.top}px`;
      marker.title = line.label;
      render.append(marker);
    });
  };

  const measureSpecimen = (specimen) => {
    clearOverlays(specimen);
    const kind = specimen.dataset.qaKind;
    const pairs = kind === "project" ? projectPairs(specimen) : kind === "publication" ? publicationPairs(specimen) : seminarPairs(specimen);
    const rows = rowSpreads(specimen, kind, pairs);
    const pairMax = pairs.length ? Math.max(...pairs.map((pair) => pair.delta)) : 0;
    const rowMax = rows.length ? Math.max(...rows.map((row) => row.spread)) : 0;
    const maxDelta = Math.max(pairMax, rowMax);
    const worstPair = [...pairs].sort((a, b) => b.delta - a.delta)[0];
    const wraps = measureWraps(specimen);
    const render = specimen.querySelector(".qa-render");
    const internalOverflow = Math.max(0, render.scrollWidth - render.clientWidth);
    const alignmentFailed = maxDelta > threshold;
    const clippingFailed = internalOverflow > 1;
    const measurementDegraded = pairs.some((pair) => pair.measurementDegraded);
    const failed = alignmentFailed || clippingFailed || measurementDegraded;
    specimen.classList.toggle("qa-fail", failed);
    specimen.classList.toggle("qa-pass", !failed);
    specimen.querySelector(".qa-status").textContent = failed ? "FAIL" : "PASS";
    specimen.querySelector("[data-qa-max]").textContent = `${rounded(maxDelta)}px`;
    specimen.querySelector("[data-qa-pairs]").textContent = pairs.map((pair) => `${pair.label}:${rounded(pair.delta)}`).join(" · ") || "n/a";
    specimen.querySelector("[data-qa-rows]").textContent = rows.map((row) => `${row.label}:${rounded(row.spread)}`).join(" · ") || "n/a";
    specimen.querySelector("[data-qa-wraps]").textContent = wraps.join(" · ") || "n/a";
    specimen.querySelector("[data-qa-overflow]").textContent = `${rounded(internalOverflow)}px`;
    drawWorstPair(specimen, worstPair);
    return {
      id: specimen.dataset.qaCase,
      kind,
      failed,
      alignmentFailed,
      clippingFailed,
      measurementDegraded,
      maxDelta: rounded(maxDelta),
      internalOverflow: rounded(internalOverflow),
      content: specimen.querySelector(".qa-specimen-head p")?.textContent || "",
      pairDeltas: pairs.map((pair) => ({
        label: pair.label,
        delta: rounded(pair.delta),
        iconCenter: rounded(pair.iconCenter),
        targetCenter: rounded(pair.targetCenter),
        wrapperRect: roundedRect(pair.wrapperRect),
        svgViewportRect: roundedRect(pair.svgRect),
        paintedRect: roundedRect(pair.iconRect),
        targetFirstLineRect: roundedRect(pair.targetRect),
        svgViewBox: pair.svgViewBox,
        measurementDegraded: pair.measurementDegraded,
        measuredShapes: pair.measuredShapes,
        failedShapes: pair.failedShapes,
        targetStyle: pair.targetStyle,
      })),
      rowSpreads: rows.map((row) => ({ ...row, spread: rounded(row.spread) })),
      wraps,
      renderedWidth: rounded(render.getBoundingClientRect().width),
    };
  };

  const environment = () => {
    const bodyStyle = getComputedStyle(document.body);
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewport: `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
      visualViewport: window.visualViewport ? `${rounded(window.visualViewport.width)}x${rounded(window.visualViewport.height)}@${rounded(window.visualViewport.scale)}` : "unavailable",
      devicePixelRatio: window.devicePixelRatio,
      layoutOrientation: matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape",
      screenOrientation: screen.orientation?.type || "unavailable",
      fontFamily: bodyStyle.fontFamily,
      fontStatus: document.fonts?.status || "unavailable",
      textSizeAdjust: getComputedStyle(document.documentElement).getPropertyValue("-webkit-text-size-adjust") || getComputedStyle(document.documentElement).textSizeAdjust || "unavailable",
    };
  };

  const renderEnvironment = (details) => {
    environmentRoot.innerHTML = `<dl>${Object.entries(details).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
  };

  const renderSummary = (results, details) => {
    const failures = results.filter((result) => result.failed).sort((a, b) => b.maxDelta - a.maxDelta);
    const alignmentFailures = results.filter((result) => result.alignmentFailed);
    const clippingFailures = results.filter((result) => result.clippingFailed);
    const degradedMeasurements = results.filter((result) => result.measurementDegraded);
    const maxDelta = results.length ? Math.max(...results.map((result) => result.maxDelta)) : 0;
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    summaryRoot.innerHTML = `<div class="qa-summary-stats">
      <div><strong>${results.length}</strong><span>total</span></div>
      <div class="${alignmentFailures.length ? "qa-stat-fail" : "qa-stat-pass"}"><strong>${alignmentFailures.length}</strong><span>over ${threshold}px</span></div>
      <div><strong>${rounded(maxDelta)}px</strong><span>maximum Δ</span></div>
      <div class="${clippingFailures.length || overflow > 1 ? "qa-stat-fail" : "qa-stat-pass"}"><strong>${clippingFailures.length}</strong><span>clipped cases</span></div>
      <div class="${degradedMeasurements.length ? "qa-stat-fail" : "qa-stat-pass"}"><strong>${degradedMeasurements.length}</strong><span>degraded SVG</span></div>
      <div class="${overflow > 1 ? "qa-stat-fail" : "qa-stat-pass"}"><strong>${rounded(Math.max(0, overflow))}px</strong><span>page overflow</span></div>
    </div>
    ${failures.length ? `<ol class="qa-failure-list">${failures.slice(0, 80).map((failure) => `<li><a href="#${escapeHtml(failure.id)}"><span>${escapeHtml(failure.id)}</span><strong>${failure.alignmentFailed ? `${failure.maxDelta}px` : failure.clippingFailed ? `${failure.internalOverflow}px clip` : "SVG fallback"}</strong></a></li>`).join("")}</ol>` : '<p class="qa-all-pass">All rendered specimens are within the 1.5px threshold with no internal clipping or degraded SVG measurements.</p>'}`;
    latestReport = {
      generatedAt: new Date().toISOString(),
      threshold,
      environment: details,
      overflow: rounded(Math.max(0, overflow)),
      total: results.length,
      failures: failures.length,
      alignmentFailures: alignmentFailures.length,
      clippingFailures: clippingFailures.length,
      degradedMeasurements: degradedMeasurements.length,
      results,
    };
  };

  const measureAll = () => {
    const details = environment();
    renderEnvironment(details);
    const results = [...document.querySelectorAll(".qa-specimen")].map(measureSpecimen);
    renderSummary(results, details);
  };

  const renderAll = async () => {
    const [projectData, publicationData, seminarData, citations] = await Promise.all([
      loadJson("projects.json"),
      loadJson("publications.json"),
      loadJson("seminars.json"),
      loadJson("citations.json"),
    ]);
    const projectPriority = new Map([["project-05", 0], ["project-03", 1], ["project-12", 2]]);
    const orderedProjects = [...(projectData.projects || [])].sort((a, b) => (projectPriority.get(a.id) ?? 99) - (projectPriority.get(b.id) ?? 99));
    const projectActual = orderedProjects.map((project, index) => ({
      id: `project-actual-${project.id || index + 1}`,
      label: `${project.program || "no program"} · ${(project.keywords || []).length} keywords · actual`,
      width: widths[2],
      html: renderProjectCard(project, { diagnostic: true }),
    }));
    const publicationActual = (publicationData.items || []).map((item, index) => ({
      id: `publication-actual-${item.id || index + 1}`,
      label: `${item.type} · ${(item.authors || []).length} authors · ${(item.keywords || []).length} keywords · actual`,
      width: widths[2],
      html: renderPublicationCard(item, { citations }),
    }));
    const seminarActual = (seminarData.seminars || []).map((seminar, index) => ({
      id: `seminar-actual-${index + 1}`,
      label: `${seminar.date} · ${seminar.speaker} · ${(seminar.keywords || []).length} keywords · actual`,
      width: widths[2],
      html: renderSeminarCard(seminar, { diagnostic: true }),
    }));
    const projectCases = [...projectActual, ...createProjectStressCases()];
    const publicationCases = [...publicationActual, ...createPublicationStressCases()];
    const seminarCases = [...seminarActual, ...createSeminarStressCases()];
    renderSuite(suiteRoots.project, "Projects", "18 production records plus program-length, keyword-count, and fixed-width stress combinations.", "project", projectCases);
    renderSuite(suiteRoots.publication, "Publications", "84 production records plus author, venue, type, keyword, and fixed-width stress combinations.", "publication", publicationCases);
    renderSuite(suiteRoots.seminar, "Seminars", "73 production records plus title, speaker, keyword, and fixed-width stress combinations.", "seminar", seminarCases);
    await document.fonts?.ready;
    requestAnimationFrame(() => requestAnimationFrame(measureAll));
  };

  copyButton?.addEventListener("click", async () => {
    if (!latestReport) return;
    const reportText = JSON.stringify(latestReport, null, 2);
    try {
      await navigator.clipboard.writeText(reportText);
      copyButton.textContent = "Copied";
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = reportText;
      document.body.append(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
      copyButton.textContent = "Copied";
    }
    setTimeout(() => { copyButton.textContent = "Copy report"; }, 1600);
  });

  const queueMeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measureAll, 180);
  };
  window.addEventListener("resize", queueMeasure);
  window.visualViewport?.addEventListener("resize", queueMeasure);
  window.addEventListener("orientationchange", queueMeasure);

  try {
    await renderAll();
  } catch (error) {
    showDataError(summaryRoot, error);
  }
})();
