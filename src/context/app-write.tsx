import React from 'react';
import { uniqueID, account, storage, db } from '../utils/config';
import {
  fileMimeTypeSetter,
  formatFileSize,
  generateString,
} from '../utils/functions';
import {
  defaultDocument,
  defaultUser,
  loginForm,
  registerForm,
} from '../utils/state';
import { Query } from 'appwrite';
import { UserDocumentProps, UserProps } from '../interface';
import { toast } from 'react-toastify';

interface AppWriteContextProps {
  register: (form: typeof registerForm) => Promise<unknown>;
  login: (form: typeof loginForm) => Promise<unknown>;
  logout: () => Promise<void>;
  getUser: () => Promise<UserProps>;
  uploadFile: (file: File) => Promise<UserDocumentProps[] | []>;
  files: File[];
  handleFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: (name: string) => void;
  handleClear: () => void;
  getAllFiles: (bucketId: string) => Promise<unknown>;
  documentsData: (typeof defaultDocument)[] | [];
  deleteFrom_db_bucket: (fileId: string) => Promise<void>;
  getEveryUserDocuments: () => Promise<UserDocumentProps[] | []>;
  getCurrentUserDocuments: (
    userId: string
  ) => Promise<{ total: number; documents: UserDocumentProps[] | [] }>;
  globalDocumentData: UserDocumentProps[] | [];
  setGlobalDocumentData: React.Dispatch<
    React.SetStateAction<UserDocumentProps[] | []>
  >;
  getDocumentById: ($id: string) => Promise<UserDocumentProps | undefined>;
  uploadUserProfile: (file: File) => Promise<string>;
  updateDocuments: (documentId: string, updatedValue: boolean ) => Promise<void>
}

const AppWriteContext = React.createContext<AppWriteContextProps>({
  register: () => Promise.resolve(),
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getUser: () => Promise.resolve(defaultUser),
  uploadFile: () => Promise.resolve([]),
  files: [],
  handleFile: (event: React.ChangeEvent<HTMLInputElement>) => {
    event;
  },
  handleRemoveFile: (name: string) => {
    name;
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handleClear: () => {
    return;
  },
  getAllFiles: () => Promise.resolve(),
  documentsData: [],
  deleteFrom_db_bucket: () => Promise.resolve(),
  getEveryUserDocuments: () => Promise.resolve([]),
  getCurrentUserDocuments: () => Promise.resolve({ total: 0, documents: [] }),
  globalDocumentData: [],
  setGlobalDocumentData: () => [],
  getDocumentById: () => Promise.resolve(defaultDocument),
  uploadUserProfile: () => Promise.resolve(''),
  updateDocuments: () => Promise.resolve(),
});


export const AppWriteContextProvider = (props: { children: React.ReactNode }) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const [documentsData, setDocumentsData] = React.useState<UserDocumentProps[] | []>([]);
  const [globalDocumentData, setGlobalDocumentData] = React.useState<UserDocumentProps[]>([]);
  const [allDocuments, setAllDocuments] = React.useState<UserDocumentProps[] | []>([]);

  // @desc To register a new user
  const register = async (form: typeof registerForm) => {
    await account.create(uniqueID, form.email, form.password, form.name);
    await account.createEmailSession(form.email, form.password);
  };

  // @desc To log in a user
  const login = async (form: typeof loginForm) => {
    await account.createEmailSession(form.email, form.password);
  };

  // @desc To log out the current user
  const logout = async () => {
    const data = await account.deleteSession('current');
    window.localStorage.removeItem('user');
    console.log('logout', data);
  };

  // @desc To verify the user's identity
  const verifyUser = React.useCallback(async () => {
    try {
      // setTriggerEffect((prev) => !prev);
      // Get user from localStorage
      const getUserFromLocalStorage = window.localStorage.getItem('user');
      // Parse user
      const user: UserProps = JSON.parse(`${getUserFromLocalStorage}`);
      // Get user from db
      const currentUser = await account.get();
      // Check for null
      if (user === null) {
        // If null, put user from db into localStorage
        window.localStorage.setItem('user', JSON.stringify(currentUser));
      } else if (currentUser && user !== null) {
        const currentUserId = currentUser.$id;
        const savedUserId = user.$id; //647200b7f40247e76178
        if (savedUserId !== currentUserId) {
          await account.deleteSession('current');
          window.localStorage.removeItem('user');
          window.location.replace('/authenticate');
        } else {
          console.log('verified');
          return;
        }
      } else {
        window.localStorage.removeItem('user');
      }
    } catch (error) {
      const location = window.location.pathname;
      if (location === '/dashboard') {
        window.localStorage.removeItem('user');
        window.location.replace('/authenticate');
      }
      console.log('something went wrong');
    }
  }, []);

  // @desc To get the current user
  const getUser = async (): Promise<UserProps> => {
    const data = await account.get();
    verifyUser();
    return data;
  };

  // @desc To handle file selection
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files;
    if (selectedFile) {
      const arrFiles = [...selectedFile, ...files];
      setFiles(Array.prototype.slice.call(arrFiles));
    }
  };

  // @desc To handle file removal
  const handleRemoveFile = (name: string) => {
    const removed_file = files.filter((file) => file.name !== name);
    toast.error(`File Removed`);
    setFiles(removed_file);
  };

  // @desc To clear all files
  const handleClear = () => {
    setFiles([]);
    setDocumentsData([]);
    toast.error(`All files removed`);
  };

  // @desc To upload a file
  const uploadFile = async (file: File): Promise<UserDocumentProps[] | []> => {
    // Generate unique ID
    const documentId = `${generateString()}${generateString()}${generateString()}`;
    const updatedFile = fileMimeTypeSetter(file);
    const data = await storage.createFile(
      `${import.meta.env.VITE_APPWRITE_BUCKET_ID}`,
      documentId,
      updatedFile
    );
    const currentUser = await getUser();
    if (data) {
      // Get information from file and data
      const view = storage.getFileView(data?.bucketId, data?.$id)?.href;
      const filename = updatedFile?.name?.toLowerCase();
      const extension = updatedFile.name.toLowerCase().split('.').pop();
      const size = formatFileSize(data?.sizeOriginal);
      const preview = storage.getFilePreview(data?.bucketId, data?.$id)?.href;
      const mimeType = updatedFile.type;
      const createdAt = data?.$createdAt;
      const updatedAt = data?.$updatedAt;
      const userId = currentUser?.$id;
      const access_file_code = generateString();
      // Database model schema
      const dbSchemaData = {
        view,
        size,
        userId,
        preview,
        mimeType,
        filename,
        createdAt,
        extension,
        updatedAt,
        access_file_code,
      };
      // Create document
      const createdDocument: typeof defaultDocument = await db.createDocument(
        `${import.meta.env.VITE_APPWRITE_DATABASE_ID}`,
        `${import.meta.env.VITE_APPWRITE_COLLECTION_ID}`,
        `${documentId}`,
        dbSchemaData
      );
      setDocumentsData((previousDoc) => [...previousDoc, createdDocument]);
    }
    console.log('documentsData', documentsData);
    return documentsData as UserDocumentProps[];
  };

  // @desc To get the current user's documents
  const getCurrentUserDocuments = async (userId: string) => {
    const data = (await db.listDocuments(
      `${import.meta.env.VITE_APPWRITE_DATABASE_ID}`,
      `${import.meta.env.VITE_APPWRITE_COLLECTION_ID}`,
      [
        Query.equal('userId', [`${userId}`]),
        // Query.equal('unique_extension', [`${unique_extension}`]),
        Query.limit(100),
      ]
    )) as unknown as { total: number; documents: UserDocumentProps[] | [] };
    return data;
  };

  // @desc To get a document by its ID
  const getDocumentById = async ($id: string) => {
    if ($id) {
      const data = (await db.getDocument(
        `${import.meta.env.VITE_APPWRITE_DATABASE_ID}`,
        `${import.meta.env.VITE_APPWRITE_COLLECTION_ID}`,
        `${$id}`
      )) as unknown as UserDocumentProps;
      return data;
    }
  };

  // @desc To get all files in a bucket
  const getAllFiles = async (bucketId: string) => {
    const data = await storage.listFiles(bucketId);
    return data;
  };

  // @desc To delete a file from the database and bucket
  const deleteFrom_db_bucket = async (fileId: string) => {
    await storage.deleteFile(
      `${import.meta.env.VITE_APPWRITE_BUCKET_ID}`,
      fileId
    );
    await db.deleteDocument(
      `${import.meta.env.VITE_APPWRITE_DATABASE_ID}`,
      `${import.meta.env.VITE_APPWRITE_COLLECTION_ID}`,
      fileId
    );
  };

  // @desc To upload a user profile image
  const uploadUserProfile = async (file: File): Promise<string> => {
    // Generate unique ID
    const documentId = generateString();
    const data = await storage.createFile(
      `${import.meta.env.VITE_APPWRITE_BUCKET_ID}`,
      documentId,
      file
    );
    const view = await storage.getFileView(data?.bucketId, data?.$id)?.href;
    const profile = { profile: view };
    const user = await account.updatePrefs({ profile });
    window.localStorage.setItem('user', JSON.stringify(user));
    return view;
  };

  // @desc To update document attributes
  const updateDocuments = async (documentId: string, updatedValue: boolean) => {
     await db.updateDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_COLLECTION_ID,
      documentId,
      // Update the Index Attribute
      { public: updatedValue }
    ) as UserDocumentProps;
   
  };

  // @desc To get every user's documents
  const getEveryUserDocuments = async (): Promise<UserDocumentProps[]> => {
    const data = await db.listDocuments(
      `${import.meta.env.VITE_APPWRITE_DATABASE_ID}`,
      `${import.meta.env.VITE_APPWRITE_COLLECTION_ID}`
    );
    setAllDocuments(data as unknown as UserDocumentProps[] | []);
    return allDocuments;
  };

  React.useEffect(() => {
    getUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    register,
    login,
    logout,
    getUser,
    uploadFile,
    files,
    handleFile,
    handleRemoveFile,
    handleClear,
    getAllFiles,
    documentsData,
    deleteFrom_db_bucket,
    getEveryUserDocuments,
    getCurrentUserDocuments,
    globalDocumentData,
    setGlobalDocumentData,
    getDocumentById,
    uploadUserProfile,
    updateDocuments,
  };

  return (
    <AppWriteContext.Provider value={value}>
      {props.children}
    </AppWriteContext.Provider>
  );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useAppwriteContext = () => React.useContext(AppWriteContext);