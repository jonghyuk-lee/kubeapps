import { CdsButton } from "@clr/react/button";
import { CdsIcon } from "@clr/react/icon";
import { assignWith } from "lodash";
import { get } from "lodash";
import React, { useEffect, useState } from "react";
// @ts-ignore
import * as yaml from "yaml";
import placeholder from "../../placeholder.png";

import actions from "actions";
import Alert from "components/js/Alert";
import Column from "components/js/Column";
import Row from "components/js/Row";
import PageHeader from "components/PageHeader/PageHeader";
import { useDispatch, useSelector } from "react-redux";
import * as ReactRouter from "react-router";
import { Link } from "react-router-dom";
import { Action } from "redux";
import { ThunkDispatch } from "redux-thunk";
import ApplicationStatus from "../../containers/ApplicationStatusContainer";
import ResourceRef from "../../shared/ResourceRef";
import {
  DeleteError,
  FetchError,
  IK8sList,
  IKubeState,
  IResource,
  IStoreState,
} from "../../shared/types";
import * as url from "../../shared/url";
import LoadingWrapper from "../LoadingWrapper/LoadingWrapper";
import AccessURLTable from "./AccessURLTable/AccessURLTable";
import DeleteButton from "./AppControls/DeleteButton/DeleteButton";
import RollbackButton from "./AppControls/RollbackButton/RollbackButton";
import AppNotes from "./AppNotes";
import AppSecrets from "./AppSecrets";
import AppValues from "./AppValues/AppValues";
import ChartInfo from "./ChartInfo/ChartInfo";
import ResourceTabs from "./ResourceTabs";

export interface IAppViewResourceRefs {
  deployments: ResourceRef[];
  statefulsets: ResourceRef[];
  daemonsets: ResourceRef[];
  services: ResourceRef[];
  ingresses: ResourceRef[];
  secrets: ResourceRef[];
  otherResources: ResourceRef[];
}

function parseResources(
  resources: Array<IResource | IK8sList<IResource, {}>>,
  kinds: IKubeState["kinds"],
  cluster: string,
  releaseNamespace: string,
) {
  const result: IAppViewResourceRefs = {
    ingresses: [],
    deployments: [],
    statefulsets: [],
    daemonsets: [],
    otherResources: [],
    services: [],
    secrets: [],
  };
  resources.forEach(i => {
    // The item may be a list
    const itemList = i as IK8sList<IResource, {}>;
    if (itemList.items) {
      // If the resource  has a list of items, treat them as a list
      // A List can contain an arbitrary set of resources so we treat them as an
      // additional manifest. We merge the current result with the resources of
      // the List, concatenating items from both.
      assignWith(
        result,
        parseResources((i as IK8sList<IResource, {}>).items, kinds, cluster, releaseNamespace),
        // Merge the list with the current result
        (prev, newArray) => prev.concat(newArray),
      );
    } else {
      const item = i as IResource;
      const resource = { isFetching: true, item };
      const kind = kinds[item.kind] || {};
      switch (i.kind) {
        case "Deployment":
          result.deployments.push(
            new ResourceRef(resource.item, cluster, kind.plural, kind.namespaced, releaseNamespace),
          );
          break;
        case "StatefulSet":
          result.statefulsets.push(
            new ResourceRef(resource.item, cluster, kind.plural, kind.namespaced, releaseNamespace),
          );
          break;
        case "DaemonSet":
          result.daemonsets.push(
            new ResourceRef(resource.item, cluster, kind.plural, kind.namespaced, releaseNamespace),
          );
          break;
        case "Service":
          result.services.push(
            new ResourceRef(resource.item, cluster, kind.plural, kind.namespaced, releaseNamespace),
          );
          break;
        case "Ingress":
          result.ingresses.push(
            new ResourceRef(resource.item, cluster, kind.plural, kind.namespaced, releaseNamespace),
          );
          break;
        case "Secret":
          result.secrets.push(
            new ResourceRef(resource.item, cluster, kind.plural, kind.namespaced, releaseNamespace),
          );
          break;
        default:
          result.otherResources.push(
            new ResourceRef(resource.item, cluster, kind.plural, kind.namespaced, releaseNamespace),
          );
      }
    }
  });
  return result;
}

interface IRouteParams {
  cluster: string;
  namespace: string;
  releaseName: string;
}

export default function AppView() {
  const dispatch: ThunkDispatch<IStoreState, null, Action> = useDispatch();
  const { cluster, namespace, releaseName } = ReactRouter.useParams() as IRouteParams;
  const [resourceRefs, setResourceRefs] = useState({
    ingresses: [],
    deployments: [],
    statefulsets: [],
    daemonsets: [],
    otherResources: [],
    services: [],
    secrets: [],
  } as IAppViewResourceRefs);
  const {
    apps: { error, selected: app },
    kube: { kinds },
  } = useSelector((state: IStoreState) => state);
  useEffect(() => {
    dispatch(actions.apps.getAppWithUpdateInfo(cluster, namespace, releaseName));
  }, [cluster, dispatch, namespace, releaseName]);

  useEffect(() => {
    if (!app?.manifest) {
      return;
    }

    let parsedManifest: IResource[] = yaml
      .parseAllDocuments(app.manifest)
      .map((doc: yaml.ast.Document) => doc.toJSON());
    // Filter out elements in the manifest that does not comply
    // with { kind: foo }
    parsedManifest = parsedManifest.filter(r => r && r.kind);
    setResourceRefs(parseResources(parsedManifest, kinds, cluster, app.namespace));
  }, [app, cluster, kinds]);

  if (error && error.constructor === FetchError) {
    return <Alert theme="danger">Application not found. Received: {error.message}</Alert>;
  }
  const {
    services,
    ingresses,
    deployments,
    statefulsets,
    daemonsets,
    secrets,
    otherResources,
  } = resourceRefs;
  const icon = get(app, "chart.metadata.icon", placeholder);
  return (
    <section>
      <PageHeader
        title={releaseName}
        titleSize="md"
        helm={true}
        icon={icon}
        buttons={[
          <Link to={url.app.apps.upgrade(cluster, namespace, releaseName)} key="upgrade-button">
            <CdsButton status="primary">
              <CdsIcon shape="upload-cloud" inverse={true} /> Upgrade
            </CdsButton>
          </Link>,
          <RollbackButton
            key="rollback-button"
            cluster={cluster}
            namespace={namespace}
            releaseName={releaseName}
            revision={app?.version || 0}
          />,
          <DeleteButton
            key="delete-button"
            cluster={cluster}
            namespace={namespace}
            releaseName={releaseName}
          />,
        ]}
      />
      {error &&
        (error.constructor === DeleteError ? (
          <Alert theme="danger">Unable to delete the application. Received: {error.message}</Alert>
        ) : (
          <Alert theme="danger">An error occurred: {error.message}</Alert>
        ))}
      {!app || !app.info ? (
        <LoadingWrapper />
      ) : (
        <Row>
          <Column span={3}>
            <ChartInfo app={app} cluster={cluster} />
          </Column>
          <Column span={9}>
            <div className="appview-separator">
              <div className="appview-first-row">
                <ApplicationStatus
                  deployRefs={deployments}
                  statefulsetRefs={statefulsets}
                  daemonsetRefs={daemonsets}
                  info={app.info}
                />
                <AccessURLTable serviceRefs={services} ingressRefs={ingresses} />
                <AppSecrets secretRefs={secrets} />
              </div>
            </div>
            <div className="appview-separator">
              <AppNotes notes={app.info && app.info.status && app.info.status.notes} />
            </div>
            <div className="appview-separator">
              <ResourceTabs
                {...{ deployments, statefulsets, daemonsets, secrets, services, otherResources }}
              />
            </div>
            <div className="appview-separator">
              <AppValues values={(app.config && app.config.raw) || ""} />
            </div>
          </Column>
        </Row>
      )}
    </section>
  );
}
