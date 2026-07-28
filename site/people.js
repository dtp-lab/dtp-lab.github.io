(async function () {
  const { escapeHtml, loadJson, imageMarkup, showDataError, applyPageHeading } = DTPLab;
  const root = document.querySelector("#people-content");
  const categoryOrder = ["phd", "master", "undergraduate", "alumni", "staff"];
  const labels = {
    professor: "Professor",
    phd: "Ph.D. Students",
    master: "M.S. Students",
    undergraduate: "Undergraduate Researchers",
    alumni: "Alumni",
    staff: "Staff",
  };
  const fieldLabels = {
    affiliation: "Affiliation",
    email: "Email",
    researchTopic: "Research topic",
    office: "Office",
    telephone: "Tel.",
  };
  const renderPhoto = (person) => `<div class="person-photo">${imageMarkup(person.image, `${person.name} 프로필`)}</div>`;
  const renderFields = (person, professor = false) => [
    ["affiliation", person.affiliation],
    ["email", person.email],
    ["researchTopic", person.researchTopic],
    ...(professor ? [["office", person.office], ["telephone", person.telephone]] : []),
  ]
    .filter(([, value]) => value)
    .map(([key, value]) => `<div><dt>${escapeHtml(fieldLabels[key] || key.replaceAll("_", " "))}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
  const renderPerson = (person) => `<article class="person-card">${renderPhoto(person)}<div class="person-body"><h3>${escapeHtml(person.name)}</h3><dl>${renderFields(person)}</dl></div></article>`;
  try {
    const data = await loadJson("people.json");
    applyPageHeading(data.page);
    const professor = data.professor;
    const careerItems = professor?.career || [];
    const careerHtml = careerItems.length ? `<section class="career-section"><h4 class="career-title">Career</h4><div class="career-list">${careerItems.map((item) => `<div><time>${escapeHtml(item.period)}</time><span>${escapeHtml(item.role)}</span></div>`).join("")}</div></section>` : "";
    const professorHtml = professor ? `<section class="people-section"><header><h2>${labels.professor}</h2><span>01</span></header><article class="professor-card">${renderPhoto(professor)}<div class="person-body"><h3>${escapeHtml(professor.name)}</h3><dl>${renderFields(professor, true)}</dl>${careerHtml}</div></article></section>` : "";
    const groupsHtml = categoryOrder.map((key) => {
      const people = (data.members || []).filter((person) => person.category === key);
      if (!people.length) return "";
      return `<section class="people-section"><header><h2>${labels[key]}</h2><span>${String(people.length).padStart(2, "0")}</span></header><div class="people-grid">${people.map(renderPerson).join("")}</div></section>`;
    }).join("");
    root.innerHTML = professorHtml + groupsHtml;
  } catch (error) { showDataError(root, error); }
})();
