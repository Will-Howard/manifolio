import React, { ChangeEvent } from "react";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles((theme: any) => ({
  calculatorRow: {
    marginBottom: "16px",
    "& input": {
      marginLeft: 8,
    },
  },
}));

interface InputFieldProps {
  id: string;
  type: string;
  label: string;
  step?: string;
  min?: string;
  max?: string;
  value: any;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const InputField: React.FC<InputFieldProps> = (props) => {
  const classes = useStyles();
  return (
    <div className={classes.calculatorRow}>
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type={props.type}
        step={props.step}
        min={props.min}
        max={props.max}
        value={props.value}
        placeholder={props.placeholder}
        readOnly={props.readOnly}
        onChange={props.onChange}
      />
    </div>
  );
};
