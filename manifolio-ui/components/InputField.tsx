import React, { ChangeEvent } from "react";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  calculatorRow: {
    marginBottom: "16px",
    "& input": {
      marginLeft: 8,
    },
  },
});

interface InputFieldProps {
  id: string;
  type: string;
  label: string;
  step?: string;
  min?: string;
  max?: string;
  value: string | number | readonly string[] | undefined;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  decimalPlaces?: number;
  significantFigures?: number;
}

const applyRounding = (
  value: number,
  decimalPlaces?: number,
  significantFigures?: number
) => {
  if (decimalPlaces !== undefined) {
    return Number(value.toFixed(decimalPlaces));
  }
  if (significantFigures !== undefined) {
    return Number(value.toPrecision(significantFigures));
  }
  return value;
};

export const InputField: React.FC<InputFieldProps> = (props) => {
  const classes = useStyles();

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (props.type === "number") {
      const value = parseFloat(e.target.value);
      const roundedValue = applyRounding(
        value,
        props.decimalPlaces,
        props.significantFigures
      );
      e.target.value = roundedValue.toString();
    }
    props.onChange(e);
  };

  const value = props.value;
  const tryRounding =
    value && props.type === "number" && typeof value === "number";
  const displayValue = tryRounding
    ? applyRounding(value, props.decimalPlaces, props.significantFigures)
    : value;

  return (
    <div className={classes.calculatorRow}>
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type={props.type}
        step={props.step}
        min={props.min}
        max={props.max}
        value={displayValue}
        placeholder={props.placeholder}
        readOnly={props.readOnly}
        onChange={handleInputChange}
      />
    </div>
  );
};
