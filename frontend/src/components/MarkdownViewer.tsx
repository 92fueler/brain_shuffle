import React from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import "@uiw/react-markdown-preview/markdown.css";
import { normalizeMarkdown } from "../indentation";

interface MarkdownViewerProps {
  source: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  source,
  className = "",
  style,
}) => {
  if (!source || !source.trim()) {
    return <span className="empty-markdown-text">No notes recorded.</span>;
  }

  const cleanSource = normalizeMarkdown(source);

  return (
    <div className={`rich-markdown-viewer ${className}`} data-color-mode="dark" style={style}>
      <MarkdownPreview
        source={cleanSource}
        style={{
          backgroundColor: "transparent",
          color: "inherit",
          fontSize: "inherit",
          ...style,
        }}
        wrapperElement={{ "data-color-mode": "dark" }}
      />
    </div>
  );
};
