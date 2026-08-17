import React from 'react';
import { shallow } from 'enzyme';
import { Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';
import { renderWithHooks } from '@libs/utils/TestUtils';
import PanelBreadcrumb from './PanelBreadcrumb';

let mockWorkspaceEnabled = true;
let mockDashboardConfiguration = {};
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: (selector) =>
    selector({
      serverConfiguration: { data: { workspaceEnabled: mockWorkspaceEnabled } },
      dashboardConfiguration: mockDashboardConfiguration,
    }),
}));

const mockHistoryPush = jest.fn();
let mockPanelId;
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({ push: mockHistoryPush }),
  useParams: () => ({ panelId: mockPanelId }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock('@hooks/roles', () => ({
  useFMRoles: () => ({ hasRole: () => false }),
}));

let mockCurrentWorkspace = { role: { name: 'role' } };
jest.mock('@hooks/workspaces', () => ({
  useWorkspaces: () => ({ currentWorkspace: mockCurrentWorkspace }),
}));

let mockAccessibleIds = new Set();
jest.mock('../../../hooks/usePanelWorkspace', () => ({
  __esModule: true,
  default: () => ({
    filterPanelsByWorkspaceRights: (panels) => panels.filter((panel) => mockAccessibleIds.has(panel._id)),
  }),
}));

const PANELS = [
  { _id: 'r1', title: 'Root 1', parentId: null },
  { _id: 'c1', title: 'Child 1', parentId: 'r1' },
  { _id: 'g1', title: 'Grandchild 1', parentId: 'c1' },
  { _id: 'c2', title: 'Child 2', parentId: 'r1' },
  { _id: 'r2', title: 'Root 2', parentId: null },
];

const FLAT_PANELS = [
  { _id: 'f1', title: 'Flat 1', parentId: null },
  { _id: 'f2', title: 'Flat 2', parentId: null },
];

function getWrapper({ panels = PANELS, panel, activePanel } = {}) {
  mockDashboardConfiguration = { originalPanels: panels };
  mockPanelId = activePanel;
  return renderWithHooks(() => shallow(<PanelBreadcrumb panel={panel} />));
}

function items(wrapper) {
  return wrapper.find(Breadcrumb.Item);
}

function segmentElement(item) {
  return item.props().children;
}

function segmentText(item) {
  return segmentElement(item).props.children;
}

describe('PanelBreadcrumb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessibleIds = new Set(['r1', 'c2', 'g1', 'r2']);
    mockCurrentWorkspace = { role: { name: 'role' } };
    mockWorkspaceEnabled = true;
    mockDashboardConfiguration = {};
    mockPanelId = undefined;
  });

  it('renders one segment with its own name for a root-level panel that has children', async () => {
    const wrapper = await getWrapper({ panel: { _id: 'r1', title: 'Root 1' } });
    const segments = items(wrapper);
    expect(segments).toHaveLength(1);
    expect(segmentElement(segments.at(0)).type).not.toEqual(Link);
    expect(segmentText(segments.at(0))).toEqual('Root 1');
  });

  it('renders two segments in root-to-current order for a level 2 panel', async () => {
    const wrapper = await getWrapper({ panel: { _id: 'c2', title: 'Child 2' } });
    const segments = items(wrapper);
    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segmentText(segment))).toEqual(['Root 1', 'Child 2']);
  });

  it('renders three segments in root-to-current order for a level 3 panel', async () => {
    const wrapper = await getWrapper({ panel: { _id: 'g1', title: 'Grandchild 1' } });
    const segments = items(wrapper);
    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segmentText(segment))).toEqual(['Root 1', 'Child 1', 'Grandchild 1']);
  });

  it('renders an accessible ancestor as a Link pointing at its dashboard route', async () => {
    const wrapper = await getWrapper({ panel: { _id: 'c2', title: 'Child 2' } });
    const rootSegment = segmentElement(items(wrapper).at(0));
    expect(rootSegment.type).toEqual(Link);
    expect(rootSegment.props.to).toEqual('/dashboard/r1');
  });

  it('never renders the current panel segment as a Link, even when it is accessible', async () => {
    const wrapper = await getWrapper({ panel: { _id: 'c2', title: 'Child 2' } });
    const currentSegment = segmentElement(items(wrapper).at(1));
    expect(currentSegment.type).not.toEqual(Link);
  });

  it('shows an inaccessible ancestor name without making it a Link or giving it an onClick', async () => {
    mockAccessibleIds = new Set(['g1']);
    const wrapper = await getWrapper({ panel: { _id: 'g1', title: 'Grandchild 1' } });
    const ancestorSegments = items(wrapper).slice(0, 2);
    ancestorSegments.forEach((segment) => {
      const element = segmentElement(segment);
      expect(element.type).not.toEqual(Link);
      expect(element.props.onClick).toBeUndefined();
    });
    expect(ancestorSegments.map((segment) => segmentText(segment))).toEqual(['Root 1', 'Child 1']);
  });

  it('renders all three names with no clickable segment when no ancestor is accessible', async () => {
    mockAccessibleIds = new Set();
    const wrapper = await getWrapper({ panel: { _id: 'g1', title: 'Grandchild 1' } });
    const segments = items(wrapper);
    expect(segments.map((segment) => segmentText(segment))).toEqual(['Root 1', 'Child 1', 'Grandchild 1']);
    expect(segments.map((segment) => segmentElement(segment).type)).not.toContain(Link);
  });

  it('renders nothing when no panel in the dashboard has a parentId', async () => {
    const wrapper = await getWrapper({ panels: FLAT_PANELS, panel: { _id: 'f1', title: 'Flat 1' } });
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('renders nothing when the panel it receives is not in the dashboard configuration', async () => {
    const wrapper = await getWrapper({ panel: { _id: 'unknown', title: 'Unknown' } });
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('renders nothing before the first fetch, when panelsById is empty', async () => {
    const wrapper = await getWrapper({ panels: [], panel: { _id: 'r1', title: 'Root 1' } });
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('renders a long name in full and keeps it as the title attribute for the native tooltip', async () => {
    const longTitle = 'a'.repeat(60);
    const panels = PANELS.map((panel) => (panel._id === 'r1' ? { ...panel, title: longTitle } : panel));
    const wrapper = await getWrapper({ panels, panel: { _id: 'r1', title: longTitle } });
    const element = segmentElement(items(wrapper).at(0));
    expect(element.props.children).toEqual(longTitle);
    expect(element.props.title).toEqual(longTitle);
  });

  it('renders only the segments that resolve when an ancestor stub is missing from the map', async () => {
    const brokenPanels = [
      { _id: 'r1', title: 'Root 1', parentId: null },
      { _id: 'g1', title: 'Grandchild 1', parentId: 'c1' },
    ];
    const wrapper = await getWrapper({ panels: brokenPanels, panel: { _id: 'g1', title: 'Grandchild 1' } });
    const segments = items(wrapper);
    expect(segments.map((segment) => segmentText(segment))).toEqual(['Grandchild 1']);
  });
});
