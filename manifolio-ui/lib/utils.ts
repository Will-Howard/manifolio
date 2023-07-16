export const formatInt = (n: number | undefined): string => {
  if (n === undefined) {
    // em-dash
    return "—";
  }

  return parseInt(n.toFixed(0)).toLocaleString();
};
