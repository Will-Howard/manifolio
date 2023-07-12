import classNames from "classnames";
import React, { ChangeEvent } from "react";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  calculatorRow: {
    marginBottom: 16,
    "& input": {
      marginLeft: 8,
    },
  },
  input: {
    lineHeight: "26px",
    borderRadius: 4,
    padding: "0 6px",
  },
  inputError: {
    border: "1px solid red",
  },
  inputSuccess: {
    border: "1px solid green",
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
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  decimalPlaces?: number;
  significantFigures?: number;
  status?: "error" | "success" | undefined;
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
    console.log(e);
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

  const inputClass =
    props.status === "error"
      ? classes.inputError
      : props.status === "success"
      ? classes.inputSuccess
      : "";

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
        disabled={props.disabled}
        onChange={handleInputChange}
        className={classNames(classes.input, inputClass)}
      />
    </div>
  );
};
