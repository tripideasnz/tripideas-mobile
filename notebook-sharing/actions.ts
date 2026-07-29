export async function copyNotebookShareLink(
  url: string,
  setString: (value: string) => Promise<boolean>
): Promise<void> {
  await setString(url);
}

export async function openNotebookShareSheet(
  notebookTitle: string,
  url: string,
  share: (
    content: { message: string; url: string },
    options: { subject: string }
  ) => Promise<unknown>
): Promise<void> {
  await share(
    {
      message: `View ${notebookTitle}: ${url}`,
      url,
    },
    { subject: notebookTitle }
  );
}
