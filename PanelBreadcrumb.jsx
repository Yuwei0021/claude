import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import usePanelHierarchy from '../../../hooks/usePanelHierarchy';
import { ancestorChainOf } from '../../../utils/panelTree';
import styles from './PanelBreadcrumb.module.scss';

PanelBreadcrumb.propTypes = {
  panel: PropTypes.shape({
    _id: PropTypes.string,
    title: PropTypes.string,
  }),
};

PanelBreadcrumb.defaultProps = {
  panel: undefined,
};

export default function PanelBreadcrumb({ panel }) {
  const { t } = useTranslation('fm-dashboard');
  const { panelsById, accessibleIds, hasHierarchy } = usePanelHierarchy();

  if (!hasHierarchy || !panelsById[panel?._id]) return null;

  const segmentIds = [...ancestorChainOf(panel._id, panelsById).reverse(), panel._id];

  return (
    <Breadcrumb aria-label={t('panelBreadcrumb.ariaLabel')}>
      {segmentIds.map((id, index) => {
        const { title } = panelsById[id];
        const isLast = index === segmentIds.length - 1;
        const clickable = !isLast && accessibleIds.has(id);
        return (
          <Breadcrumb.Item key={id}>
            {clickable ? (
              <Link className={styles.segment} to={`/dashboard/${id}`} title={title}>
                {title}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={classnames(styles.segment, !isLast && styles.contextOnly)}
                title={title}
              >
                {title}
              </span>
            )}
          </Breadcrumb.Item>
        );
      })}
    </Breadcrumb>
  );
}
