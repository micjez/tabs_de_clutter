export function formatDate(dateAdded) {
  if (!dateAdded && dateAdded !== 0) return '';
  const date = new Date(dateAdded);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

export function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\|/g, '\\|')
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ');
}

export function generateMarkdownTable(bookmarks) {
  if (!bookmarks || bookmarks.length === 0) {
    return '# Bookmarks\n\nNo bookmarks found.';
  }

  const headers = ['Title', 'URL', 'Date Added', 'Folder Path'];
  const rows = bookmarks.map(bookmark => [
    escapeMarkdown(bookmark.title || 'Untitled'),
    escapeMarkdown(bookmark.url || ''),
    formatDate(bookmark.dateAdded),
    escapeMarkdown(bookmark.folderPath || '')
  ]);

  const table = [
    '# Bookmarks',
    '',
    '| ' + headers.join(' | ') + ' |',
    '|' + headers.map(() => '---').join('|') + '|',
    ...rows.map(row => '| ' + row.join(' | ') + ' |')
  ].join('\n');

  return table;
}

export function buildFolderPath(bookmark, folderMap) {
  const path = [];
  let currentId = bookmark.parentId;
  const visited = new Set();
  
  while (currentId && folderMap[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    path.unshift(folderMap[currentId].title);
    currentId = folderMap[currentId].parentId;
  }
  
  return path.join(' > ');
}

export function extractBookmarksFromFolder(folderNode, folderMap = {}) {
  const bookmarks = [];
  
  if (!folderNode) return bookmarks;
  
  folderMap[folderNode.id] = folderNode;
  
  if (folderNode.children) {
    for (const child of folderNode.children) {
      if (child.url) {
        bookmarks.push({
          id: child.id,
          title: child.title,
          url: child.url,
          dateAdded: child.dateAdded,
          parentId: child.parentId || folderNode.id,
          index: child.index,
          folderPath: buildFolderPath(child, folderMap)
        });
      } else if (child.children) {
        const childBookmarks = extractBookmarksFromFolder(child, folderMap);
        bookmarks.push(...childBookmarks);
      }
    }
  }
  
  return bookmarks;
}
