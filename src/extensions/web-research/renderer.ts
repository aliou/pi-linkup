import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { MESSAGE_TYPE_RESEARCH_RESULT } from "./manager";
import type { ResearchResultDetails } from "./render";

/**
 * Render the follow-up messages delivered when a background research
 * task finishes (customType "linkup-research-result").
 */
export function registerResearchMessageRenderer(pi: ExtensionAPI): void {
  pi.registerMessageRenderer(
    MESSAGE_TYPE_RESEARCH_RESULT,
    (message, options, theme) => {
      const { expanded } = options;
      const container = new Container();

      const details = message.details as ResearchResultDetails | undefined;
      const headerText =
        details?.status === "completed"
          ? "Linkup: research completed"
          : "Linkup: research update";
      const header = `${theme.fg("accent", theme.bold(headerText))} ${theme.fg("muted", details?.taskId ?? "")}`;
      container.addChild(new Text(header, 0, 0));

      if (details?.answer) {
        container.addChild(renderAnswer(details, expanded, theme));
      } else {
        container.addChild(
          new Text(theme.fg("muted", String(message.content ?? "")), 0, 0),
        );
      }

      return container;
    },
  );
}

function renderAnswer(
  details: ResearchResultDetails,
  expanded: boolean,
  theme: Theme,
): Container {
  const answer = details.answer ?? "";
  const sources = details.sources ?? [];
  const component = new Container();

  if (!expanded) {
    let text = `  ${theme.fg("muted", answer.slice(0, 100))}`;
    if (answer.length > 100) {
      text += theme.fg("dim", "...");
    }
    text += `\n  ${theme.fg("dim", `${sources.length} source(s)`)} ${theme.fg("muted", "(expand for full answer)")}`;
    component.addChild(new Text(text, 0, 0));
  } else {
    component.addChild(
      new Markdown(answer, 0, 0, getMarkdownTheme(), {
        color: (text: string) => theme.fg("toolOutput", text),
      }),
    );
    for (const source of sources) {
      component.addChild(
        new Text(`  ${theme.fg("dim", `${source.name}: ${source.url}`)}`, 0, 0),
      );
    }
  }

  return component;
}
