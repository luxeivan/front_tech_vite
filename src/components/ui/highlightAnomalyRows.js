// /src/components/ui/highlightAnomalyRows.js

/** Мягко подсветить строки таблицы, где встречается любой из guidList — через animejs */
export async function animateRowsByGuids(containerEl, guidList = []) {
  if (typeof document === "undefined" || !containerEl || !guidList.length)
    return;

  // ищем строки
  const rows = Array.from(containerEl.querySelectorAll("tbody tr"));
  const hits = rows.filter((tr) =>
    guidList.some((g) => (tr.textContent || "").includes(g))
  );
  if (!hits.length) return;

  try {
    const mod = await import("animejs");
    const anime = mod?.default || mod?.anime || mod;

    // изначально подсветим цветом
    hits.forEach((tr) => {
      tr.style.willChange = "background-color, transform";
      tr.style.backgroundColor = "rgba(227,112,33,0.14)";
      tr.style.transformOrigin = "center";
    });

    // дыхание + затухание подсветки
    anime
      .timeline()
      .add({
        targets: hits,
        scale: [
          { value: 1, duration: 0 },
          { value: 1.01, duration: 320 },
        ],
        easing: "easeOutQuad",
        delay: anime.stagger(70),
      })
      .add({
        targets: hits,
        scale: 1,
        backgroundColor: "rgba(227,112,33,0)",
        duration: 900,
        easing: "easeInOutQuad",
      });
  } catch {
    // если animejs не подтянулся — ничего страшного
  }
}
