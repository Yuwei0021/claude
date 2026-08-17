import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { MemoryRouter, Route, Switch } from 'react-router';
import { CompatRouter } from 'react-router-dom-v5-compat';
import '@testing-library/jest-dom/extend-expect';
import PanelBreadcrumb from '../lib/components/Panels/PanelBreadcrumb';

console.warn = jest.fn();

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock('@hooks/roles', () => ({
  useFMRoles: () => ({ hasRole: () => false }),
}));

const GRANTED = { type: 'BY_ROLE', rights: { R1: null } };
const DENIED = { type: 'BY_ROLE', rights: { R9: null } };

const PANELS = [
  { _id: 'r1', title: 'Root 1', parentId: null, workspaceRights: GRANTED },
  { _id: 'c11', title: 'Child 1.1', parentId: 'r1', workspaceRights: GRANTED },
  { _id: 'g111', title: 'Grandchild 1.1.1', parentId: 'c11', workspaceRights: GRANTED },
  { _id: 'r2', title: 'Root 2', parentId: null, workspaceRights: DENIED },
  { _id: 'c21', title: 'Child 2.1', parentId: 'r2', workspaceRights: GRANTED },
  { _id: 'g211', title: 'Grandchild 2.1.1', parentId: 'c21', workspaceRights: GRANTED },
];

const mockStore = configureMockStore();

function buildStore(panels, workspaceEnabled) {
  return mockStore({
    serverConfiguration: { data: { workspaceEnabled } },
    dashboardConfiguration: { originalPanels: panels },
    workspace: { currentWorkspace: { role: { name: 'R1', permissions: [] } } },
    currentUser: { data: { id: 'u1', effectiveRoles: [{ id: 'r1', name: 'R1', permissions: [] }] } },
  });
}

function renderBreadcrumb({ panels = PANELS, panel, routePanelId = panel?._id, workspaceEnabled = true } = {}) {
  const history = { entries: [] };

  const result = render(
    <Provider store={buildStore(panels, workspaceEnabled)}>
      <MemoryRouter initialEntries={[`/dashboard/${routePanelId}`]}>
        <CompatRouter>
          <Switch>
            <Route
              path="/dashboard/:panelId"
              render={({ location }) => {
                history.entries.push(location.pathname);
                return <PanelBreadcrumb panel={panel} />;
              }}
            />
          </Switch>
        </CompatRouter>
      </MemoryRouter>
    </Provider>
  );

  return { ...result, history };
}

function panelOf(id, panels = PANELS) {
  return panels.find((panel) => panel._id === id);
}

function segments() {
  return Array.from(document.querySelectorAll('.ant-breadcrumb-link')).map((node) => node.textContent);
}

function segmentNode(text) {
  return screen.getByText(text).closest('.ant-breadcrumb-link');
}

describe('Panel breadcrumb', () => {
  it('BR-1/BR-6 — shows the full path from the root to the open panel, deepest last', () => {
    renderBreadcrumb({ panel: panelOf('g111') });
    expect(segments()).toEqual(['Root 1', 'Child 1.1', 'Grandchild 1.1.1']);
  });

  it('BR-2 — separates the segments with /', () => {
    renderBreadcrumb({ panel: panelOf('g111') });
    const separators = Array.from(document.querySelectorAll('.ant-breadcrumb-separator')).map(
      (node) => node.textContent
    );
    // antd renders a separator after every item and hides the trailing one with CSS
    expect(separators).toEqual(['/', '/', '/']);
  });

  it('BR-7 — a root panel shows a single plain segment with its own name', () => {
    renderBreadcrumb({ panel: panelOf('r1') });
    expect(segments()).toEqual(['Root 1']);
    expect(segmentNode('Root 1').querySelector('a')).toBeNull();
  });

  it('BR-4 — clicking an accessible ancestor navigates to that panel', () => {
    const { history } = renderBreadcrumb({ panel: panelOf('g111') });
    userEvent.click(screen.getByText('Child 1.1'));
    expect(history.entries).toContain('/dashboard/c11');
  });

  it('BR-3 — the current panel is never a link, even when the user has access to it', () => {
    const { history } = renderBreadcrumb({ panel: panelOf('c11') });
    const current = segmentNode('Child 1.1');
    expect(current.querySelector('a')).toBeNull();
    userEvent.click(screen.getByText('Child 1.1'));
    expect(history.entries).toEqual(['/dashboard/c11']);
  });

  it('BR-5/BR-10 — an ancestor the workspace rights deny keeps its name but is not navigable', () => {
    const { history } = renderBreadcrumb({ panel: panelOf('g211') });
    expect(segments()).toEqual(['Root 2', 'Child 2.1', 'Grandchild 2.1.1']);

    const denied = segmentNode('Root 2');
    expect(denied.querySelector('a')).toBeNull();
    expect(denied.querySelector('span')).toHaveClass('contextOnly');

    userEvent.click(screen.getByText('Root 2'));
    expect(history.entries).toEqual(['/dashboard/g211']);
    expect(segmentNode('Child 2.1').querySelector('a')).not.toBeNull();
  });

  it('BR-5/BR-9 — with workspaces off, a contextOnly stub ancestor still shows its name and is not navigable', () => {
    const panels = [
      { _id: 'r1', title: 'Root 1', parentId: null, contextOnly: true },
      { _id: 'c11', title: 'Child 1.1', parentId: 'r1' },
    ];
    const { history } = renderBreadcrumb({
      panels,
      panel: panelOf('c11', panels),
      workspaceEnabled: false,
    });

    expect(segments()).toEqual(['Root 1', 'Child 1.1']);
    expect(segmentNode('Root 1').querySelector('a')).toBeNull();
    userEvent.click(screen.getByText('Root 1'));
    expect(history.entries).toEqual(['/dashboard/c11']);
  });

  it('BR-8 — renders no breadcrumb row when no panel has a parent', () => {
    const panels = [
      { _id: 'r1', title: 'Root 1', parentId: null, workspaceRights: GRANTED },
      { _id: 'r2', title: 'Root 2', parentId: null, workspaceRights: GRANTED },
    ];
    const { container } = renderBreadcrumb({ panels, panel: panelOf('r1', panels) });
    expect(container.querySelector('.ant-breadcrumb')).toBeNull();
  });

  it('BR-11/BR-15 — describes the panel it receives, not the panel named in the URL', () => {
    renderBreadcrumb({ panel: panelOf('g111'), routePanelId: 'c21' });
    expect(segments()).toEqual(['Root 1', 'Child 1.1', 'Grandchild 1.1.1']);
  });

  it('BR-14 — a chain broken by a missing ancestor starts at the first known one', () => {
    const panels = [
      { _id: 'c11', title: 'Child 1.1', parentId: 'gone', workspaceRights: GRANTED },
      { _id: 'g111', title: 'Grandchild 1.1.1', parentId: 'c11', workspaceRights: GRANTED },
    ];
    renderBreadcrumb({ panels, panel: panelOf('g111', panels) });
    expect(segments()).toEqual(['Child 1.1', 'Grandchild 1.1.1']);
  });

  it('BR-17 — a long name is rendered in full and kept as the native tooltip', () => {
    const longTitle = 'L'.repeat(60);
    const panels = [
      { _id: 'r1', title: longTitle, parentId: null, workspaceRights: GRANTED },
      { _id: 'c11', title: 'Child 1.1', parentId: 'r1', workspaceRights: GRANTED },
    ];
    const { history } = renderBreadcrumb({ panels, panel: panelOf('c11', panels) });

    const link = screen.getByText(longTitle);
    expect(link).toHaveAttribute('title', longTitle);

    userEvent.click(link);
    expect(history.entries).toContain('/dashboard/r1');
  });

  it('marks the current panel segment as the current page for assistive technology', () => {
    renderBreadcrumb({ panel: panelOf('g111') });
    expect(screen.getByText('Grandchild 1.1.1')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Child 1.1')).not.toHaveAttribute('aria-current');
  });

  it('renders nothing when the panel store is still empty', () => {
    const { container } = renderBreadcrumb({ panels: [], panel: { _id: 'g111', title: 'Grandchild 1.1.1' } });
    expect(container.querySelector('.ant-breadcrumb')).toBeNull();
  });

  it('renders nothing when the open panel is not in the loaded configuration', () => {
    const { container } = renderBreadcrumb({ panel: { _id: 'unknown', title: 'Unknown' } });
    expect(container.querySelector('.ant-breadcrumb')).toBeNull();
  });
});
