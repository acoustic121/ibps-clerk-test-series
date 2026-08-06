import React from "react";

interface Props {
  text: string | null | undefined;
  className?: string;
}

export const FormattedText: React.FC<Props> = ({ text, className }) => {
  if (!text) return null;

  // Format line breaks and HTML tags safely
  const formattedHtml = text
    .replace(/\n/g, "<br/>")
    .replace(/<b>/g, "<strong>")
    .replace(/<\/b>/g, "</strong>");

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
};
