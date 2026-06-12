import React, { useEffect, useState } from 'react';

import { useNavigate, Link } from 'react-router-dom';

import {
  authFetch,
  clearStoredUser,
  getStoredUser,
  isAdminUser,
  parseErrorMessage,
  syncStoredUserRole,
} from './api';
import { appAlert, appConfirm } from './modal';

import Layout from './components/Layout';

import LoadingSpinner from './components/LoadingSpinner';

import DashboardAnalytics, {

  DashboardAnalyticsData,

} from './components/DashboardAnalytics';

import DocumentPresenceBadge from './components/DocumentPresenceBadge';

import PermissionBadge from './components/PermissionBadge';

import SharedUsersList, { SharedUser } from './components/SharedUsersList';

import NetworkPanel, {

  NetworkFeed,

  NetworkSummary,

} from './components/NetworkPanel';

import { useDocumentPresence } from './hooks/useDocumentPresence';



interface User {

  _id: string;

  name: string;

  email: string;

  role?: string;

  documents: {

    _id: string;

    name: string;

    owner: { _id: string; name: string } | null;

    permission?: string;

    sharedAt?: string;

    sharedUsers?: SharedUser[];

    networkId?: string | null;

    networkVisible?: boolean;

  }[];

}



interface IncomingRequest {

  documentId: string;

  documentName: string;

  requesterId: string;

  requesterName: string;

  permission: string;

}



interface OutgoingRequest {

  documentId: string;

  documentName: string;

  ownerId: string;

  ownerName: string;

  permission: string;

}



const getInitials = (name: string) =>

  name

    .split(' ')

    .map(part => part[0])

    .join('')

    .slice(0, 2)

    .toUpperCase();



const Dashboard: React.FC = () => {

  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);

  const [networks, setNetworks] = useState<NetworkSummary[]>([]);

  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);

  const [networkFeed, setNetworkFeed] = useState<NetworkFeed | null>(null);

  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);

  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);

  const [analytics, setAnalytics] = useState<DashboardAnalyticsData | null>(null);

  const [error, setError] = useState('');

  const { getDocumentPresence } = useDocumentPresence();

  const storedUser = getStoredUser();



  useEffect(() => {

    const storedUser = getStoredUser();

    if (!storedUser) {

      navigate('/login');

      return;

    }



    const loadDashboard = async () => {

      try {

        const [profileRes, networksRes, incomingRes, outgoingRes, analyticsRes] =

          await Promise.all([

            authFetch(`/users/${storedUser._id}`),

            authFetch('/networks'),

            authFetch(`/users/${storedUser._id}/incoming-requests`),

            authFetch(`/users/${storedUser._id}/outgoing-requests`),

            authFetch(`/users/${storedUser._id}/analytics`),

          ]);



        if (!profileRes.ok) {

          const message = await parseErrorMessage(profileRes, 'Failed to load profile');

          throw new Error(message);

        }



        const [profile, networkList, incomingRequests, outgoingRequests, analyticsData] =

          await Promise.all([

            profileRes.json(),

            networksRes.ok ? networksRes.json() : [],

            incomingRes.json(),

            outgoingRes.json(),

            analyticsRes.ok ? analyticsRes.json() : null,

          ]);



        if (profile.role) {
          syncStoredUserRole(profile.role);
        }

        setUser(profile);

        setNetworks(networkList);

        setIncoming(incomingRequests);

        setOutgoing(outgoingRequests);

        if (analyticsData) {

          setAnalytics(analyticsData);

        }



        if (networkList.length > 0) {

          const firstNetworkId = networkList[0]._id;

          setActiveNetworkId(firstNetworkId);

          const feedRes = await authFetch(`/networks/${firstNetworkId}/feed`);

          if (feedRes.ok) {

            setNetworkFeed(await feedRes.json());

          }

        }

      } catch (err) {

        if ((err as Error).message !== 'Session expired') {

          setError((err as Error).message || 'Failed to load dashboard');

        }

      }

    };



    loadDashboard();

  }, [navigate]);



  const createDoc = async () => {

    const res = await authFetch('/documents', {

      method: 'POST',

      body: JSON.stringify({}),

    });



    if (!res.ok) {

      const message = await parseErrorMessage(res, 'Failed to create document');

      await appAlert(message, { variant: 'error' });

      return;

    }



    const doc = await res.json();

    navigate(`/document/${doc._id}`);

  };



  const sendRequest = async (docId: string, permission: string) => {

    const res = await authFetch(`/documents/${docId}/request`, {

      method: 'POST',

      body: JSON.stringify({ permission }),

    });



    if (!res.ok) {

      const message = await parseErrorMessage(res, 'Failed to send request');

      await appAlert(message, { variant: 'error' });

      return;

    }



    await appAlert('Request sent', { variant: 'success', title: 'Request sent' });

  };



  const grantRequest = async (docId: string, requesterId: string) => {

    const res = await authFetch(`/documents/${docId}/requests/${requesterId}/grant`, {

      method: 'POST',

    });



    if (!res.ok) {

      const message = await parseErrorMessage(res, 'Failed to grant access');

      await appAlert(message, { variant: 'error' });

      return;

    }



    setIncoming(prev =>

      prev.filter(r => !(r.documentId === docId && r.requesterId === requesterId))

    );

  };



  const deleteDoc = async (docId: string, docName: string) => {

    const label = docName || 'Untitled Document';

    const confirmed = await appConfirm(`Delete "${label}"? This cannot be undone.`, {
      title: 'Delete document',
      confirmLabel: 'Delete',
      variant: 'error',
    });

    if (!confirmed) {

      return;

    }



    const res = await authFetch(`/documents/${docId}`, { method: 'DELETE' });



    if (!res.ok) {

      const message = await parseErrorMessage(res, 'Failed to delete document');

      await appAlert(message, { variant: 'error' });

      return;

    }



    setUser(prev => {

      if (!prev) return prev;

      return {

        ...prev,

        documents: prev.documents.filter(doc => doc._id !== docId),

      };

    });

    setIncoming(prev => prev.filter(r => r.documentId !== docId));

  };



  const removeRequest = async (

    docId: string,

    requesterId: string,

    type: 'incoming' | 'outgoing'

  ) => {

    const res = await authFetch(`/documents/${docId}/requests/${requesterId}`, {

      method: 'DELETE',

    });



    if (!res.ok) {

      const message = await parseErrorMessage(res, 'Failed to remove request');

      await appAlert(message, { variant: 'error' });

      return;

    }



    if (type === 'incoming') {

      setIncoming(prev =>

        prev.filter(r => !(r.documentId === docId && r.requesterId === requesterId))

      );

    } else {

      setOutgoing(prev => prev.filter(r => r.documentId !== docId));

    }

  };



  const handleLogout = () => {

    clearStoredUser();

    navigate('/login');

  };



  const ownedDocs = (user?.documents || []).filter(

    doc => doc.owner && doc.owner._id === user?._id

  );

  const sharedDocs = (user?.documents || []).filter(

    doc => doc.owner && doc.owner._id !== user?._id

  );

  const isAdmin = isAdminUser(storedUser) || isAdminUser(user);



  if (error) {

    return (

      <Layout title="Dashboard">

        <div className="error-state glass-card">

          <p>{error}</p>

          <button className="btn btn--secondary" onClick={() => navigate('/login')}>

            Back to Login

          </button>

        </div>

      </Layout>

    );

  }



  if (!user) {

    return (

      <Layout>

        <LoadingSpinner label="Loading your workspace..." />

      </Layout>

    );

  }



  return (

    <Layout

      title="Your workspace"

      subtitle="Create documents, join networks, and share only what you choose."

      actions={

        <>

          {isAdmin && (

            <Link to="/admin" className="btn btn--secondary">

              Admin

            </Link>

          )}

          <Link to="/profile" className="btn btn--secondary">

            Profile

          </Link>

          <button className="btn btn--primary" onClick={createDoc}>

            + New Document

          </button>

          <button className="btn btn--ghost" onClick={handleLogout}>

            Logout

          </button>

        </>

      }

    >

      <div className="dashboard">

        {isAdmin && (
          <div className="admin-workspace-banner glass-card">
            <div>
              <strong>Admin personal workspace</strong>
              <p>
                This is your own documents view. Platform management lives in the Admin
                Console.
              </p>
            </div>
            <Link to="/admin" className="btn btn--primary btn--sm">
              Open Admin Console
            </Link>
          </div>
        )}

        <section className="dashboard-hero glass-card">

          <div className="dashboard-hero__profile">

            <Link to="/profile" className="dashboard-hero__profile-link">

              <div className="avatar" aria-hidden="true">

                {getInitials(user.name)}

              </div>

              <div>

                <h2>{user.name}</h2>

                <p>{user.email}</p>

                <span className="dashboard-hero__edit">Edit profile</span>

              </div>

            </Link>

          </div>

          <div className="dashboard-hero__actions dashboard-hero__actions--mobile">

            {isAdmin && (

              <Link to="/admin" className="btn btn--secondary">

                Admin

              </Link>

            )}

            <Link to="/profile" className="btn btn--secondary">

              Profile

            </Link>

            <button className="btn btn--primary" onClick={createDoc}>

              + New Document

            </button>

            <button className="btn btn--ghost" onClick={handleLogout}>

              Logout

            </button>

          </div>

        </section>



        {analytics && <DashboardAnalytics analytics={analytics} />}



        <section className="dashboard-panel glass-card">

          <div className="panel-header">

            <h3>Your Networks</h3>

            <span>{networks.length} joined</span>

          </div>

          <NetworkPanel

            networks={networks}

            activeNetworkId={activeNetworkId}

            feed={networkFeed}

            onNetworksChange={setNetworks}

            onActiveNetworkChange={setActiveNetworkId}

            onFeedChange={setNetworkFeed}

            onRequestAccess={sendRequest}

          />

        </section>



        <div className="dashboard-grid">

          <section className="dashboard-panel dashboard-panel--half glass-card">

            <div className="panel-header">

              <h3>Your Documents</h3>

              <span>{ownedDocs.length} total</span>

            </div>

            <ul className="item-list">

              {ownedDocs.length === 0 ? (

                <li className="empty-state">No documents yet. Create your first one.</li>

              ) : (

                ownedDocs.map(doc => (

                  <li key={doc._id} className="item-card">

                    <div className="item-card__main">

                      <button

                        className="item-card__title"

                        onClick={() => navigate(`/document/${doc._id}`)}

                      >

                        {doc.name || 'Untitled Document'}

                      </button>

                      <div className="item-card__meta">

                        <span className="badge badge--edit">Owner</span>

                        {doc.networkVisible ? (

                          <span className="badge badge--success">In network</span>

                        ) : (

                          <span className="badge badge--view">Private</span>

                        )}

                        <DocumentPresenceBadge

                          users={getDocumentPresence(doc._id)}

                          currentUserId={storedUser?._id}

                        />

                      </div>

                      <div className="item-card__shared-access">

                        <span className="item-card__shared-label">Shared with</span>

                        <SharedUsersList users={doc.sharedUsers || []} />

                      </div>

                    </div>

                    <div className="item-card__actions">

                      <button

                        className="btn btn--secondary btn--sm"

                        onClick={() => navigate(`/document/${doc._id}`)}

                      >

                        Open

                      </button>

                      <button

                        className="btn btn--danger btn--sm"

                        onClick={() => deleteDoc(doc._id, doc.name)}

                      >

                        Delete

                      </button>

                    </div>

                  </li>

                ))

              )}

            </ul>

          </section>



          <section className="dashboard-panel dashboard-panel--half glass-card">

            <div className="panel-header">

              <h3>Shared With You</h3>

              <span>{sharedDocs.length} shared</span>

            </div>

            <ul className="item-list">

              {sharedDocs.length === 0 ? (

                <li className="empty-state">No shared documents yet.</li>

              ) : (

                sharedDocs.map(doc => (

                  <li key={doc._id} className="item-card">

                    <div className="item-card__main">

                      <button

                        className="item-card__title"

                        onClick={() => navigate(`/document/${doc._id}`)}

                      >

                        {doc.name || 'Untitled Document'}

                      </button>

                      <div className="item-card__meta">

                        {doc.owner && <span>by {doc.owner.name}</span>}

                        {doc.sharedAt && (

                          <span>{new Date(doc.sharedAt).toLocaleDateString()}</span>

                        )}

                        <DocumentPresenceBadge

                          users={getDocumentPresence(doc._id)}

                          currentUserId={storedUser?._id}

                        />

                      </div>

                      <div className="item-card__your-access">

                        <span className="item-card__access-label">Your access</span>

                        <PermissionBadge permission={doc.permission} size="md" />

                        <span className="item-card__access-hint">

                          {doc.permission === 'edit'

                            ? 'You can read and write this document'

                            : 'You can read this document only'}

                        </span>

                      </div>

                    </div>

                    <div className="item-card__actions">

                      <button

                        className="btn btn--secondary btn--sm"

                        onClick={() => navigate(`/document/${doc._id}`)}

                      >

                        Open

                      </button>

                    </div>

                  </li>

                ))

              )}

            </ul>

          </section>



          <section className="dashboard-panel dashboard-panel--half glass-card">

            <div className="panel-header">

              <h3>Incoming Requests</h3>

              <span>{incoming.length} pending</span>

            </div>

            <ul className="item-list">

              {incoming.length === 0 ? (

                <li className="empty-state">No incoming access requests.</li>

              ) : (

                incoming.map(r => (

                  <li key={r.documentId + r.requesterId} className="item-card">

                    <div className="item-card__main">

                      <strong>{r.requesterName}</strong>

                      <div className="item-card__meta">

                        <span>

                          wants {r.permission} on {r.documentName}

                        </span>

                        <span className="badge badge--pending">Pending</span>

                      </div>

                    </div>

                    <div className="item-card__actions">

                      <button

                        className="btn btn--success btn--sm"

                        onClick={() => grantRequest(r.documentId, r.requesterId)}

                      >

                        Grant

                      </button>

                      <button

                        className="btn btn--danger btn--sm"

                        onClick={() =>

                          removeRequest(r.documentId, r.requesterId, 'incoming')

                        }

                      >

                        Decline

                      </button>

                    </div>

                  </li>

                ))

              )}

            </ul>

          </section>



          <section className="dashboard-panel dashboard-panel--half glass-card">

            <div className="panel-header">

              <h3>Outgoing Requests</h3>

              <span>{outgoing.length} waiting</span>

            </div>

            <ul className="item-list">

              {outgoing.length === 0 ? (

                <li className="empty-state">No outgoing requests.</li>

              ) : (

                outgoing.map(r => (

                  <li key={r.documentId} className="item-card">

                    <div className="item-card__main">

                      <strong>{r.documentName}</strong>

                      <div className="item-card__meta">

                        <span>

                          to {r.ownerName} for {r.permission}

                        </span>

                        <span className="badge badge--pending">Sent</span>

                      </div>

                    </div>

                    <div className="item-card__actions">

                      <button

                        className="btn btn--ghost btn--sm"

                        onClick={() => removeRequest(r.documentId, user._id, 'outgoing')}

                      >

                        Cancel

                      </button>

                    </div>

                  </li>

                ))

              )}

            </ul>

          </section>

        </div>

      </div>

    </Layout>

  );

};



export default Dashboard;


