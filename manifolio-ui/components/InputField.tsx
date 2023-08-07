import classNames from "classnames";
import React, { ChangeEvent } from "react";
import { createUseStyles } from "react-jss";
import CrossIcon from "./icons/CrossIcon";

const useStyles = createUseStyles({
  calculatorRow: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 8,
  },
  headerSection: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 8,
  },
  subtitle: {
    fontStyle: "italic",
    fontSize: "0.8rem",
  },
  inputWrapper: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    lineHeight: "26px",
    borderRadius: 4,
    padding: "0 6px",
    flex: 1,
    minWidth: 0, // inputs have a fairly large min-width by default
  },
  inputError: {
    border: "2px solid red",
  },
  inputSuccess: {
    border: "2px solid green",
  },
  clearButton: {
    cursor: "pointer",
    userSelect: "none",
    height: 24,
    marginLeft: 4,
    color: "#a8a8a8",
  },
});

interface InputFieldProps {
  id: string;
  type: string;
  label?: string | JSX.Element;
  subtitle?: string | JSX.Element;
  step?: string;
  min?: string;
  max?: string;
  value: string | number | readonly string[] | undefined;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  decimalPlaces?: number;
  significantFigures?: number;
  status?: "error" | "success" | undefined;
  className?: string;
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
    <div className={classNames(classes.calculatorRow, props.className)}>
      {(props.label || props.subtitle) && (
        <div className={classes.headerSection}>
          {props.label && <label htmlFor={props.id}>{props.label}</label>}
          {props.subtitle && (
            <span className={classes.subtitle}>{props.subtitle}</span>
          )}
        </div>
      )}
      <div className={classes.inputWrapper}>
        <input
          id={props.id}
          type={props.type}
          step={props.step}
          min={props.min}
          max={props.max}
          value={displayValue ?? ""}
          placeholder={props.placeholder}
          readOnly={props.readOnly}
          disabled={props.disabled}
          onChange={handleInputChange}
          className={classNames(classes.input, {
            [classes.inputSuccess]: props.status === "success",
            [classes.inputError]: props.status === "error",
          })}
        />
        {props.onClear && (
          <CrossIcon className={classes.clearButton} onClick={props.onClear} />
        )}
      </div>
    </div>
  );
};
