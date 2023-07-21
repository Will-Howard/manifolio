import React from "react";
import { createUseStyles } from "react-jss";
import { ManifolioErrorCode } from "./hooks/useErrors";
import classNames from "classnames";
import WarningIcon from "./icons/WarningIcon";

export type ManifolioError = {
  key: string;
  code: ManifolioErrorCode;
  message: string;
  severity: "error" | "warning";
};

type ErrorMessageProps = {
  error: ManifolioError;
};

const useStyles = createUseStyles({
  root: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    borderRadius: "4px",
    border: "2px solid",
    margin: "8px 0",
  },
  warning: {
    color: "#ff9200",
    borderColor: "#ff9200",
    backgroundColor: "#FFECB3",
  },
  error: {
    color: "#F44336",
    borderColor: "#F44336",
    backgroundColor: "#FFCDD2",
  },
  errorIcon: {
    width: "24px",
    height: "24px",
    marginRight: "10px",
  },
  message: {
    fontWeight: 500,
    color: "black",
    flex: 1,
  },
});

const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  const classes = useStyles();

  return (
    <div
      className={classNames(classes.root, {
        [classes.error]: error.severity === "error",
        [classes.warning]: error.severity === "warning",
      })}
    >
      <WarningIcon className={classes.errorIcon} />
      <div className={classes.message}>{error.message}</div>
    </div>
  );
};

export default ErrorMessage;
