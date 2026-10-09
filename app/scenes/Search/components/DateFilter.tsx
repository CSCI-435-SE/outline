import { format as formatDate } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import type { DateFilter as TDateFilter } from "@shared/types";
import { dateLocale, parseISODate, toISODate } from "@shared/utils/date";
import FilterOptions from "~/components/FilterOptions";
import Text from "~/components/Text";
import useUserLocale from "~/hooks/useUserLocale";

/** Option key used for the custom date range, never sent to the API. */
const CustomRangeKey = "custom";

type DateRange = {
  dateFrom?: string;
  dateTo?: string;
};

type Props = {
  /** The selected date filter */
  dateFilter?: string | null;
  /** The start of the custom range (yyyy-MM-dd), inclusive */
  dateFrom?: string;
  /** The end of the custom range (yyyy-MM-dd), inclusive */
  dateTo?: string;
  /** Callback when a date filter is selected */
  onSelect: (key: TDateFilter) => void;
  /** Callback when the custom range changes, the custom range option is only shown when provided */
  onRangeChange?: (range: DateRange) => void;
};

const DateFilter = ({
  dateFilter,
  dateFrom = "",
  dateTo = "",
  onSelect,
  onRangeChange,
}: Props) => {
  const { t } = useTranslation();
  const userLocale = useUserLocale();
  const locale = dateLocale(userLocale);
  const hasRange = !!(dateFrom || dateTo);
  const [showRange, setShowRange] = useState(hasRange);
  const isCustom = !!onRangeChange && (showRange || hasRange);

  const from = parseISODate(dateFrom);
  const to = parseISODate(dateTo);
  const isInvalid = !!(from && to && from > to);
  const today = toISODate(new Date());

  const fromLabel = from && formatDate(from, "MMM d, yyyy", { locale });
  const toLabel = to && formatDate(to, "MMM d, yyyy", { locale });
  const customLabel =
    fromLabel && toLabel
      ? `${fromLabel} – ${toLabel}`
      : fromLabel
        ? t("Since {{ date }}", { date: fromLabel })
        : toLabel
          ? t("Until {{ date }}", { date: toLabel })
          : t("Custom range");

  const options = useMemo(
    () => [
      {
        key: "",
        label: t("All time"),
      },
      {
        key: "day",
        label: t("Past day"),
      },
      {
        key: "week",
        label: t("Past week"),
      },
      {
        key: "month",
        label: t("Past month"),
      },
      {
        key: "year",
        label: t("Past year"),
      },
      ...(onRangeChange
        ? [
            {
              key: CustomRangeKey,
              label: customLabel,
            },
          ]
        : []),
    ],
    [t, customLabel, onRangeChange]
  );

  const handleSelect = (key: string | null | undefined) => {
    if (key === CustomRangeKey) {
      setShowRange(true);
      if (!hasRange) {
        // Clear any preset so it does not keep filtering the results.
        onRangeChange?.({});
      }
      return;
    }

    setShowRange(false);
    onSelect(key as TDateFilter);
  };

  return (
    <>
      <FilterOptions
        options={options}
        selectedKeys={[isCustom ? CustomRangeKey : dateFilter]}
        onSelect={handleSelect}
        defaultLabel={t("Any time")}
      />
      {isCustom && onRangeChange && (
        <Range>
          <Label>
            {t("From")}
            <DateInput
              type="date"
              value={dateFrom}
              max={dateTo || today}
              onChange={(ev) =>
                onRangeChange({ dateFrom: ev.target.value || undefined })
              }
            />
          </Label>
          <Label>
            {t("To")}
            <DateInput
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={today}
              onChange={(ev) =>
                onRangeChange({ dateTo: ev.target.value || undefined })
              }
            />
          </Label>
          {isInvalid && (
            <Text type="danger" size="small" role="alert">
              {t("The start date must be on or before the end date")}
            </Text>
          )}
        </Range>
      )}
    </>
  );
};

const Range = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 8px;
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: ${s("textSecondary")};
`;

const DateInput = styled.input`
  height: 28px;
  padding: 0 6px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: none;
  color: ${s("text")};
  font-family: inherit;
  font-size: 14px;
  color-scheme: ${(props) => (props.theme.isDark ? "dark" : "light")};

  &:focus {
    outline: none;
    border-color: ${s("inputBorderFocused")};
  }
`;

export default DateFilter;
