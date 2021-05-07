const pad = (nr: number | string) => nr.toString().padStart(2, "0");

const format = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatDM = (d: string, m: string) => `${new Date().getFullYear()}-${pad(m)}-${pad(d)}`;

const sundayDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + (7 - (d.getDay() || 7)));
  return d;
};

export const today = () => format(new Date());
export const sunday = () => format(sundayDate());
export const thisMonday = () => {
  const d = sundayDate();
  d.setDate(d.getDate() - 6);
  return format(d);
};

export type DateParser = (date: string) => string;

export const parseDate: DateParser = (dateStr) => {
  switch (dateStr.toLowerCase()) {
    case "l":
      return "later";
    case "s":
      return "someday";
    case "today":
    case "t":
      return format(new Date());
    case "tomorrow":
    case "tm": {
      const d = new Date();
      d.setDate(new Date().getDate() + 1);
      return format(d);
    }
    case "this week":
    case "tw":
      return format(sundayDate());
    case "next week":
    case "nw": {
      const d = sundayDate();
      d.setDate(d.getDate() + 7);
      return format(d);
    }
    default: {
      const date = /^(\d{1,2})\.(\d{1,2})/;
      const match = dateStr.match(date);
      if (match) {
        const [, day, month] = match;
        return formatDM(day, month);
      }
      return dateStr;
    }
  }
};
