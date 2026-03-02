import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * 組織選択ページ
 * 複数orgに所属するユーザーが遷移先orgを選択する
 */
const OrgSelectPage = () => {
  const navigate = useNavigate();
  const { membership, setCurrentOrgId } = useAuth();

  const organizations = membership?.organizations || [];

  const handleSelectOrg = (orgId) => {
    setCurrentOrgId(orgId);
    navigate(`/admin/org/${orgId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-8">組織を選択してください</h1>

        {organizations.length === 0 ? (
          <p className="text-center text-gray-500">所属する組織がありません。</p>
        ) : (
          <div className="grid gap-4">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectOrg(org.id)}
                className="bg-white border border-gray-200 rounded-lg p-6 text-left hover:border-blue-400 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{org.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">ID: {org.id}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    org.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {org.status === 'active' ? '有効' : '停止中'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgSelectPage;
