import type { PeriodCategory, TimetableProject } from "./model";

export function savePeriodCategory(
  project: TimetableProject,
  value: PeriodCategory,
): TimetableProject {
  const category = { ...value, name: value.name.trim() };
  if (!category.name || category.name.length > 80)
    throw new Error("Give this category a name of up to 80 characters.");
  if (
    project.periodCategories.some(
      (c) =>
        c.id !== category.id &&
        c.name.toLowerCase() === category.name.toLowerCase(),
    )
  )
    throw new Error(
      "A category with that name already exists. Choose a different name.",
    );
  const previous = project.periodCategories.find((c) => c.id === category.id);
  if (!previous && project.periodCategories.length >= 40)
    throw new Error("You can have up to 40 period categories.");
  return {
    ...project,
    periodCategories: previous
      ? project.periodCategories.map((c) =>
          c.id === category.id ? category : c,
        )
      : [...project.periodCategories, category],
    // Follow category renames for default labels, preserving custom labels
    // such as Afternoon break and Period 1.
    periods:
      previous && previous.name !== category.name
        ? project.periods.map((period) =>
            period.categoryId === category.id && period.name === previous.name
              ? { ...period, name: category.name }
              : period,
          )
        : project.periods,
  };
}

export function deletePeriodCategory(
  project: TimetableProject,
  categoryId: string,
  replacementId?: string,
): TimetableProject {
  if (!project.periodCategories.some((category) => category.id === categoryId))
    return project;
  const used = project.periods.some(
    (period) => period.categoryId === categoryId,
  );
  if (
    used &&
    (!replacementId ||
      replacementId === categoryId ||
      !project.periodCategories.some(
        (category) => category.id === replacementId,
      ))
  )
    throw new Error(
      "Choose a replacement category for the periods using this one.",
    );
  return {
    ...project,
    periodCategories: project.periodCategories.filter(
      (category) => category.id !== categoryId,
    ),
    periods: project.periods.map((period) =>
      period.categoryId === categoryId
        ? { ...period, categoryId: replacementId! }
        : period,
    ),
  };
}
