// filterServerKnowledge filters out any duplicate items in an array with lower server_knowledge
export function filterServerKnowledge(data) {
  const seen = new Map();
  return data.filter((item) => {
    const duplicate = seen.has(item.data.id);
    if (duplicate) {
      return item.server_knowledge > seen.get(item.data.id);
    }
    seen.set(item.data.id, item.server_knowledge);
    return !duplicate;
  });
}

// range generates an array of numbers from a start to end value
export function range(from, to) {
  let result = [];
  for (let i = from; i <= to; i++) {
    result.push(i);
  }
  return result;
}

// daysInMonth returns the number of days in specified month and year
export function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

// capitalizeFirstLetter capitalizes the first letter of a string
export function capitalizeFirstLetter(val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}
