import type { InventoryType } from "@/types/inventory.types";

/**
 * Reference display order for the public count form, mirroring the field
 * order on the company's paper/Cognito "Latest Inventory Form" — captured
 * per inventory type by `ultimatrix_id`. Cognito hand-orders fields to match
 * the physical walkthrough of the store (coolers, then dry storage, then
 * paper goods, etc.), which isn't derivable from any field already on `Item`
 * (not alphabetical, not by tag, not by id), so it's reproduced here as data.
 *
 * An `ultimatrix_id` missing from a type's list (a newer catalog item Cognito
 * hasn't been updated with yet) sorts after every listed id, in whatever
 * order the API returned it — nothing is hidden, it just falls to the end.
 */
const REFERENCE_ORDER: Record<InventoryType, string[]> = {
  daily: [
    "4759", "4540", "4660", "4760", "3932", "3929", "404", "389", "1103",
    "1042", "1515", "3813", "4659", "5858", "02", "03", "11", "17", "01",
  ],
  weekly: [
    "02", "03", "17", "11", "1515", "3813", "3705", "3144", "3636", "3638",
    "3150", "3157", "4943", "4790", "4786", "4336", "4961", "1723", "9218",
    "4969", "4841", "4785", "3932", "3929", "1103", "404", "389", "1042",
    "4913", "1040", "456", "1612", "1710", "1709", "393", "1486", "349",
    "339", "92506", "476", "1095", "953", "967", "920", "1016", "4759",
    "4760", "4540", "4660", "4659", "5858", "4781", "4782", "4342", "4846",
    "3858", "4524", "3835", "4930", "3860", "5108", "340", "3202", "3204",
    "3201", "3203", "5103", "5031", "468", "6938", "6304", "6319", "4230",
    "6934", "01",
  ],
  period: [
    "02", "03", "17", "11", "1515", "3813", "3705", "3144", "3636", "3638",
    "3150", "3157", "4943", "4790", "4786", "4336", "4961", "1723", "9218",
    "4969", "4841", "4785", "3932", "3929", "1103", "404", "389", "1042",
    "4913", "1040", "456", "1612", "1710", "1709", "393", "1486", "349",
    "339", "92506", "476", "1095", "953", "967", "920", "1016", "4759",
    "4760", "4540", "4660", "4659", "5858", "4781", "4782", "4342", "4846",
    "3858", "4524", "3835", "4930", "3860", "5108", "340", "3202", "3204",
    "3201", "3203", "5103", "5031", "468", "6938", "6304", "6319", "4230",
    "5647", "5648", "6209", "6200", "6210", "5532", "5748", "5645", "5646",
    "5651", "6205", "5650", "5474",
    "6934", "01",
  ],
};

/** Sorts items into the reference order for `type`; unlisted ids keep their
 *  relative order and are appended after every listed item. */
export function sortByReferenceOrder<T extends { ultimatrix_id: string }>(
  items: T[],
  type: InventoryType
): T[] {
  const order = REFERENCE_ORDER[type];
  const rank = new Map(order.map((id, i) => [id, i]));
  return items
    .map((item, i) => ({ item, rank: rank.get(item.ultimatrix_id) ?? order.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}
